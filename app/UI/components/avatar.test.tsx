/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { Avatar } from "./avatar.tsx";

render(<Avatar picture="logo.webp" class="border"></Avatar>, document.body);
