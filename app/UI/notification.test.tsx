import { notify } from "./notification.ts";

console.log("hi");
notify(
    "123",
    "123",
    "123",
    () => {
        console.log("click");
    },
);
