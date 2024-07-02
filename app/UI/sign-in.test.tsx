/** @jsx h */
import { h, render } from "preact";
import { testEventBus } from "./_setup.test.ts";
import { SignIn } from "./sign-in.tsx";

render(
    <SignIn
        emit={testEventBus.emit}
    />,
    document.body,
);
