import { assertEquals } from "https://deno.land/std@0.176.0/testing/asserts.ts";
import { ChatMessage, groupContinuousMessages, parseContent } from "./message.ts";
import { PrivateKey } from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/key.ts";

Deno.test("inline parse", async (t) => {
    const data = [
        {
            input: `nothing`,
            output: [],
        },
        {
            input:
                `https://nostr.build/i/f91187675750791b652f7e129b374c2b682d7cc0e9dbc28def58ffdf66508867.jpg`,
            output: [{
                type: "url",
                start: 0,
                end: 89,
            }],
        },
        {
            input:
                ` https://nostr.build/i/f91187675750791b652f7e129b374c2b682d7cc0e9dbc28def58ffdf66508867.jpg`,
            output: [{
                type: "url",
                start: 1,
                end: 90,
            }],
        },
        {
            input:
                `https://nostr.build/i/f91187675750791b652f7e129b374c2b682d7cc0e9dbc28def58ffdf66508867.jpg `,
            output: [{
                type: "url",
                start: 0,
                end: 89,
            }],
        },
        {
            input:
                ` https://nostr.build/i/f91187675750791b652f7e129b374c2b682d7cc0e9dbc28def58ffdf66508867.jpg `,
            output: [{
                type: "url",
                start: 1,
                end: 90,
            }],
        },
        {
            input: `Hi https://some.jpg`,
            output: [{
                type: "url",
                start: 3,
                end: 18,
            }],
        },
        {
            input: `Hi https://some.jpg http://some.jpg`,
            output: [{
                type: "url",
                start: 3,
                end: 18,
            }, {
                type: "url",
                start: 20,
                end: 34,
            }],
        },
        {
            input: `nostr:npub17dxnfw2vrhgtk4fgqdmpuqxv05u9raau3w0shay7msmr0dzs4m7s6ng4ylログボ`,
            output: [{
                type: "npub",
                pubkey: "f34d34b94c1dd0bb552803761e00cc7d3851f7bc8b9f0bf49edc3637b450aefd",
                start: 6,
                end: 68,
            }],
        },
        {
            input: `npub17dxnfw2vrhgtk4fgqdmpuqxv05u9raau3w0shay7msmr0dzs4m7s6ng4yl`,
            output: [{
                type: "npub",
                pubkey: "f34d34b94c1dd0bb552803761e00cc7d3851f7bc8b9f0bf49edc3637b450aefd",
                start: 0,
                end: 62,
            }],
        },
        // {
        //     input: `nostr:nevent1qqsz25j8nrppstgmyry8hgsg4fggtfa6xnym2n4c2xth7usxtydtgpcpp4mhxue69uhhjctzw5hx6egzyze7g05vclndlu36x0vjzw37jykcjkcu8ep9qfqwpjvahmlrq6947qcyqqqqqqgj5mjek`,
        //     output: [{
        //         type: "nevent",
        //         start: 0,
        //         end: 161,
        //     }],
        // },
        {
            input: `Thank you #[0]​ #[2]#[3]`,
            output: [{
                type: "tag",
                start: 10,
                end: 13,
            }, {
                type: "tag",
                start: 16,
                end: 19,
            }, {
                type: "tag",
                start: 20,
                end: 23,
            }],
        },
    ];
    for (const [i, test] of data.entries()) {
        await t.step(test.input, () => {
            assertEquals(test.output, Array.from(parseContent(test.input)));
        });
    }
});

Deno.test("message group", () => {
    const data: ChatMessage[] = [
        {
            // don't care the value of event
            event: {
                content: "",
                created_at: 1,
                id: "",
                kind: 1,
                pubkey: "",
                sig: "",
                tags: [],
                parsedContentItems: [],
                parsedTags: {
                    e: [],
                    p: [],
                },
                publicKey: PrivateKey.Generate().toPublicKey(),
            },
            "content": "sendDirectMessage",
            "type": "text",
            "created_at": new Date("2023-03-11T09:50:47.000Z"),
            lamport: 0,
        },
    ];
    const groups = Array.from(groupContinuousMessages([
        {
            root: data[0],
            replies: [],
        },
    ], () => true));
    assertEquals(groups.length, 1);
    assertEquals(groups[0].length, 1);
});
