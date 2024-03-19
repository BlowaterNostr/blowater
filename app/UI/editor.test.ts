import { assertEquals } from "https://deno.land/std@0.202.0/testing/asserts.ts";
import { generateTags } from "./editor.ts";

Deno.test("generate tags", async (t) => {
    const data = [
        {
            input: "nothing",
            output: [],
        },
        {
            input:
                "One event: nostr:nevent1qqszxuauudy4j09cc88fwepl0d8jx035z62dwrxwlkg5dj5e85rmlacpr9mhxue69uhkymr0washgetj9ehx7um5wgcjucm0d5pzpzrlsfckzvuw7nf7sdyzfxrxftt52n90n0d86zqv8vegy8cnj3cgqvzqqqqqqyfae0ls",
            output: [
                [
                    "e",
                    "2373bce349593cb8c1ce97643f7b4f233e341694d70ccefd9146ca993d07bff7",
                    "wss://blowater.nostr1.com",
                    "mention",
                ],
                [
                    "p",
                    "887f827161338ef4d3e83482498664ad7454caf9bda7d080c3b32821f1394708",
                    "",
                    "mention",
                ],
                [
                    "q",
                    "2373bce349593cb8c1ce97643f7b4f233e341694d70ccefd9146ca993d07bff7",
                ],
            ],
        },
        {
            input: "One public key: nostr:npub17dkjwcvgwlrkhvxvlk2xh6erl9w4dnt87gxswvugd7paypacyn5qp8gy87",
            output: [
                [
                    "p",
                    "f36d27618877c76bb0ccfd946beb23f95d56cd67f20d0733886f83d207b824e8",
                    "",
                    "mention",
                ],
            ],
        },
        {
            input: "Duplicate public key: nostr:npub17dkjwcvgwlrkhvxvlk2xh6erl9w4dnt87gxswvugd7paypacyn5qp8gy87 nostr:npub17dkjwcvgwlrkhvxvlk2xh6erl9w4dnt87gxswvugd7paypacyn5qp8gy87",
            output: [
                [
                    "p",
                    "f36d27618877c76bb0ccfd946beb23f95d56cd67f20d0733886f83d207b824e8",
                    "",
                    "mention",
                ],
            ],
        },
    ];
    for (const [_, test] of data.entries()) {
        await t.step(test.input, () => {
            assertEquals(test.output, Array.from(generateTags(test.input)));
        });
    }
});
