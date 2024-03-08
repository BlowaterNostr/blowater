/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { testEventBus } from "../../_setup.test.ts";
import { SignUp } from "./sign-up.tsx";

render(
    <SignUp
        emit={testEventBus.emit}
    />,
    document.body,
);
