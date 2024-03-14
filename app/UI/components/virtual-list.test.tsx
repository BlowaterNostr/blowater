/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { VirtualList } from "./virtual-list.tsx";

const rowSizes = new Array(100000).fill(true).map(() => 25 + Math.round(Math.random() * 55));
const getItemSize = (index: number) => rowSizes[index];

interface RowProps {
    index: number;
    style: Record<string, string | number>;
}

const Row = ({ index, style }: RowProps) => {
    return (
        <li class={index % 2 ? "bg-green-200" : "bg-blue-200"} style={style}>
            Row {index}
        </li>
    );
};

const App = () => {
    return (
        <div class={`flex w-screen h-screen justify-center items-center`}>
            <VirtualList
                height={300}
                width={300}
                itemSize={getItemSize}
                itemCount={100000}
            >
                {Row}
            </VirtualList>
        </div>
    );
};

render(<App />, document.body);
