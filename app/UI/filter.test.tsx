import { h, render } from "preact";
import { Filter } from "./filter.tsx";
import { testEventBus } from "./_setup.test.ts";

render(<Filter emit={testEventBus.emit} />, document.body);
