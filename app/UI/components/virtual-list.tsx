/** @jsx h */
// Fork from https://gitee.com/zhutouqietuzai/virtual-list
import { Component, createRef, FunctionComponent, h, JSX } from "https://esm.sh/preact@10.17.1";
import { useState } from "https://esm.sh/preact@10.17.1/hooks";

import { PublicKey } from "../../../libs/nostr.ts/key.ts";
import { ChatMessage } from "../message.ts";
import { emitFunc } from "../../event-bus.ts";
import { DirectMessagePanelUpdate, SyncEvent } from "../message-panel.tsx";
import { SelectConversation } from "../search_model.ts";
import { ProfileGetter } from "../search.tsx";
import { RelayRecordGetter } from "../../database.ts";
import { ProfileData } from "../../features/profile.ts";

interface MeasuredData {
    measuredDataMap: Record<number, { size: number; offset: number }>;
    lastMeasuredItemIndex: number;
}

const measuredData: MeasuredData = {
    measuredDataMap: {},
    lastMeasuredItemIndex: -1,
};

const estimatedHeight = (defaultEstimatedItemSize = 50, itemCount: number) => {
    let measuredHeight = 0;
    const { measuredDataMap, lastMeasuredItemIndex } = measuredData;
    // Calculate the sum of heights for items that have already obtained their real height.
    if (lastMeasuredItemIndex >= 0) {
        const lastMeasuredItem = measuredDataMap[lastMeasuredItemIndex];
        measuredHeight = lastMeasuredItem.offset + lastMeasuredItem.size;
    }
    // The number of items that have not been calculated for the actual height.
    const unMeasuredItemsCount = itemCount - measuredData.lastMeasuredItemIndex - 1;
    // Predicted total height.
    const totalEstimatedHeight = measuredHeight + unMeasuredItemsCount * defaultEstimatedItemSize;
    return totalEstimatedHeight;
};

const getItemMetaData = (props: VirtualListProps, index: number) => {
    const { itemEstimatedSize = 50 } = props;
    const { measuredDataMap, lastMeasuredItemIndex } = measuredData;
    // If the current index is larger than the recorded index, it means that the size and offset of the item at the current index need to be calculated
    if (index > lastMeasuredItemIndex) {
        let offset = 0;
        // Calculate the maximum offset value that can be calculated currently
        if (lastMeasuredItemIndex >= 0) {
            const lastMeasuredItem = measuredDataMap[lastMeasuredItemIndex];
            offset += lastMeasuredItem.offset + lastMeasuredItem.size;
        }
        // Calculate all uncalculated items until the index
        for (let i = lastMeasuredItemIndex + 1; i <= index; i++) {
            const currentItemSize = itemEstimatedSize;
            measuredDataMap[i] = { size: currentItemSize, offset };
            offset += currentItemSize;
        }
        // Update the index value of the calculated item
        measuredData.lastMeasuredItemIndex = index;
    }
    return measuredDataMap[index];
};

const getStartIndex = (props: VirtualListProps, scrollOffset: number) => {
    const { itemCount } = props;
    let index = 0;
    while (true) {
        const currentOffset = getItemMetaData(props, index).offset;
        if (currentOffset >= scrollOffset) return index;
        if (index >= itemCount) return itemCount;
        index++;
    }
};

const getEndIndex = (props: VirtualListProps, startIndex: number) => {
    const { height, itemCount } = props;
    // Get the item that starts within the visible area
    const startItem = getItemMetaData(props, startIndex);
    // The maximum offset value within the visible area
    const maxOffset = startItem.offset + height;
    // The offset of the next item in the starting item, and then continuously add this offset until it is equal to or exceeds the maximum offset, which is finding the ending index
    let offset = startItem.offset + startItem.size;
    let endIndex = startIndex;
    // Calculate the cumulative offset
    while (offset <= maxOffset && endIndex < (itemCount - 1)) {
        endIndex++;
        const currentItem = getItemMetaData(props, endIndex);
        offset += currentItem.size;
    }
    return endIndex;
};

const getRangeToRender = (props: VirtualListProps, scrollOffset: number) => {
    const { itemCount } = props;
    const preBuffer = 10;
    const postBuffer = 10;
    const startIndex = getStartIndex(props, scrollOffset);
    const endIndex = getEndIndex(props, startIndex);
    return [
        Math.max(0, startIndex - preBuffer),
        Math.min(itemCount - 1, endIndex + postBuffer),
    ];
};

interface ListItemProps {
    index: number;
    style: Record<string, string | number>;
    ComponentType: FunctionComponent<any>;
    onSizeChange: (index: number, domNode: HTMLElement) => void;
}

class ListItem extends Component<ListItemProps> {
    domRef = createRef<HTMLDivElement>();
    resizeObserver: ResizeObserver | null = null;
    componentDidMount() {
        if (this.domRef.current && this.domRef.current.firstChild instanceof HTMLElement) {
            const domNode = this.domRef.current.firstChild;
            const { index, onSizeChange } = this.props;
            this.resizeObserver = new ResizeObserver(() => {
                onSizeChange(index, domNode);
            });
            this.resizeObserver.observe(domNode);
        }
    }
    componentWillUnmount() {
        if (
            this.resizeObserver && this.domRef.current &&
            this.domRef.current.firstChild instanceof HTMLElement
        ) {
            this.resizeObserver.unobserve(this.domRef.current.firstChild);
        }
    }
    render() {
        const { index, style, ComponentType } = this.props;
        return (
            <div style={style} ref={this.domRef}>
                <ComponentType index={index} />
            </div>
        );
    }
}

interface VirtualListProps {
    height: number;
    itemCount: number;
    itemEstimatedSize?: number;
    children: FunctionComponent<any>;
    // copy from message-list.tsx Props
    // myPublicKey: PublicKey;
    // messages: ChatMessage[];
    // emit: emitFunc<DirectMessagePanelUpdate | SelectConversation | SyncEvent>;
    // getters: {
    //     profileGetter: ProfileGetter;
    //     relayRecordGetter: RelayRecordGetter;
    //     getEventByID: func_GetEventByID;
    // };
    // copy end
}

export const VirtualList = (props: VirtualListProps) => {
    const { height, itemCount, itemEstimatedSize = 50, children: Child } = props;
    const [scrollOffset, setScrollOffset] = useState(0);
    const [, forceUpdate] = useState(0);

    const containerStyle = {
        position: "relative",
        width: "100%",
        height,
        overflow: "auto",
        willChange: "transform",
    };

    const contentStyle = {
        height: estimatedHeight(itemEstimatedSize, itemCount),
        width: "100%",
    };

    const sizeChangeHandle = (index: number, domNode: HTMLElement) => {
        const height = domNode.offsetHeight;
        const { measuredDataMap, lastMeasuredItemIndex } = measuredData;
        const itemMetaData = measuredDataMap[index];
        itemMetaData.size = height;
        let offset = 0;
        for (let i = 0; i <= lastMeasuredItemIndex; i++) {
            const itemMetaData = measuredDataMap[i];
            itemMetaData.offset = offset;
            offset += itemMetaData.size;
        }
        // Ii is necessary to update the state to trigger the re-rendering of the component
        forceUpdate((prevflag) => (prevflag + 1));
    };

    const getCurrentChildren = () => {
        const [startIndex, endIndex] = getRangeToRender(
            props,
            scrollOffset,
        );
        const items = [];
        for (let i = startIndex; i <= endIndex; i++) {
            const item = getItemMetaData(props, i);
            const itemStyle = {
                position: "absolute",
                height: item.size,
                width: "100%",
                top: item.offset,
            };
            items.push(
                <ListItem
                    key={i}
                    index={i}
                    style={itemStyle}
                    ComponentType={Child}
                    onSizeChange={sizeChangeHandle}
                />,
            );
        }
        return items;
    };

    const scrollHandle = (event: h.JSX.TargetedEvent<HTMLDivElement>) => {
        const { scrollTop } = event.currentTarget;
        setScrollOffset(scrollTop);
    };

    return (
        <div style={containerStyle} onScroll={scrollHandle}>
            <ol style={contentStyle}>
                {getCurrentChildren()}
            </ol>
        </div>
    );
};
