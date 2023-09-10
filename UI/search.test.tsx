/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { Search, SearchResultsChan } from "./search.tsx";

const testData = [
    {
        text: "aaaaaa",
        id: "aaaaaa",
        picture: "https://i.pinimg.com/originals/f4/b9/3a/f4b93a502f60397fe92b663ddb9e683d.jpg",
    },
    {
        text: "bbbbbb",
        id: "bbbbbb",
        picture: "https://i.pinimg.com/originals/f4/b9/3a/f4b93a502f60397fe92b663ddb9e683d.jpg",
    },
    {
        text: "ccccccc",
        id: "ccccccc",
        picture: "https://i.pinimg.com/originals/f4/b9/3a/f4b93a502f60397fe92b663ddb9e683d.jpg",
    },
    {
        text: "ddddddd",
        id: "ddddddd",
        picture: "https://i.pinimg.com/originals/f4/b9/3a/f4b93a502f60397fe92b663ddb9e683d.jpg",
    },
    {
        text: "eeeeeee",
        id: "eeeeeee",
        picture: "https://i.pinimg.com/originals/f4/b9/3a/f4b93a502f60397fe92b663ddb9e683d.jpg",
    },
];

render(
    <Search
        placeholder="search for data"
        onInput={async (text) => {
            await SearchResultsChan.put(testData.filter((data) => data.text.includes(text)));
        }}
        onSelect={(id) => {
            console.log(id);
            console.log(testData.find((data) => data.id == id));
        }}
    />,
    document.body,
);
