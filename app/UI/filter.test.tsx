import { h, render } from "https://esm.sh/preact@10.17.1";
import { Filter } from "./filter.tsx";
import { testEventBus } from "./_setup.test.ts";

render(<Filter emit={testEventBus.emit} />, document.body);
