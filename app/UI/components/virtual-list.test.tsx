/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { VirtualList } from "./virtual-list.tsx";

const items: h.JSX.Element[] = [];
const itemCount = 1000;
for (let i = 0; i < itemCount; i++) {
    const height = 30 + Math.floor(Math.random() * 30);
    const style = {
        height,
        width: "100%",
    };
    items.push(
        <div className={i % 2 ? "bg-blue-200" : "bg-green-200"} style={style}>Row {i}</div>,
    );
}

const Row = ({ index }: { index: number }) => items[index];

const App = () => {
    return (
        <div class={`flex w-screen h-screen justify-center items-center`}>
            <VirtualList
                height={300}
                itemCount={itemCount}
            >
                {Row}
            </VirtualList>
        </div>
    );
};

render(<App />, document.body);
