/** @jsx h */
// Fork from https://gitee.com/zhutouqietuzai/virtual-list
import { FunctionComponent, h } from "https://esm.sh/preact@10.17.1";
import { useState } from "https://esm.sh/preact@10.17.1/hooks";

interface MeasuredData {
    measuredDataMap: Record<number, { size: number; offset: number }>;
    LastMeasuredItemIndex: number;
}

const measuredData: MeasuredData = {
    measuredDataMap: {},
    LastMeasuredItemIndex: -1,
};

const estimatedHeight = (defaultEstimatedItemSize = 50, itemCount: number) => {
    let measuredHeight = 0;
    const { measuredDataMap, LastMeasuredItemIndex } = measuredData;
    // Calculate the sum of heights for items that have already obtained their real height.
    if (LastMeasuredItemIndex >= 0) {
        const lastMeasuredItem = measuredDataMap[LastMeasuredItemIndex];
        measuredHeight = lastMeasuredItem.offset + lastMeasuredItem.size;
    }
    // The number of items that have not been calculated for the actual height.
    const unMeasuredItemsCount = itemCount - measuredData.LastMeasuredItemIndex - 1;
    // Predicted total height.
    const totalEstimatedHeight = measuredHeight + unMeasuredItemsCount * defaultEstimatedItemSize;
    return totalEstimatedHeight;
};

const getItemMetaData = (props: VirtualListProps, index: number) => {
    const { itemSize } = props;
    const { measuredDataMap, LastMeasuredItemIndex } = measuredData;
    // If the current index is larger than the recorded index, it means that the size and offset of the item at the current index need to be calculated
    if (index > LastMeasuredItemIndex) {
        let offset = 0;
        // Calculate the maximum offset value that can be calculated currently
        if (LastMeasuredItemIndex >= 0) {
            const lastMeasuredItem = measuredDataMap[LastMeasuredItemIndex];
            offset += lastMeasuredItem.offset + lastMeasuredItem.size;
        }
        // Calculate all uncalculated items until the index
        for (let i = LastMeasuredItemIndex + 1; i <= index; i++) {
            const currentItemSize = itemSize(i);
            measuredDataMap[i] = { size: currentItemSize, offset };
            offset += currentItemSize;
        }
        // Update the index value of the calculated item
        measuredData.LastMeasuredItemIndex = index;
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

interface VirtualListProps {
    height: number;
    width: number;
    itemSize: (index: number) => number;
    itemCount: number;
    children: FunctionComponent<{ index: number; style: any }>;
    itemEstimatedSize?: number;
}

export const VirtualList = (props: VirtualListProps) => {
    const { height, width, itemCount, itemEstimatedSize, children: Child } = props;
    const [scrollOffset, setScrollOffset] = useState(0);

    const containerStyle = {
        position: "relative",
        width,
        height,
        overflow: "auto",
        willChange: "transform",
    };

    const contentStyle = {
        height: estimatedHeight(itemEstimatedSize, itemCount),
        width: "100%",
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
                <Child key={i} index={i} style={itemStyle} />,
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
