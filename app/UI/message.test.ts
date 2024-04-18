import { assertEquals } from "https://deno.land/std@0.202.0/assert/assert_equals.ts";
import {
    ChatMessage,
    findUrlInString,
    groupContinuousMessages,
    parseContent,
} from "./message.ts";
import { PrivateKey } from "../../libs/nostr.ts/key.ts";

import { NostrKind } from "../../libs/nostr.ts/nostr.ts";

Deno.test("inline parse", async (t) => {
    const data = [
        {
            input: "",
            output: [],
        },
        {
            input: `nothing`,
            output: [{
                text: "nothing",
                type: "normal",
            }],
        },
        {
            input:
                `https://nostr.build/i/f91187675750791b652f7e129b374c2b682d7cc0e9dbc28def58ffdf66508867.jpg`,
            output: [{
                text:
                    "https://nostr.build/i/f91187675750791b652f7e129b374c2b682d7cc0e9dbc28def58ffdf66508867.jpg",
                type: "url",
            }],
        },
        {
            input:
                ` https://nostr.build/i/f91187675750791b652f7e129b374c2b682d7cc0e9dbc28def58ffdf66508867.jpg`,
            output: [
                {
                    text: " ",
                    type: "normal",
                },
                {
                    text:
                        "https://nostr.build/i/f91187675750791b652f7e129b374c2b682d7cc0e9dbc28def58ffdf66508867.jpg",
                    type: "url",
                },
            ],
        },
        {
            input:
                `https://nostr.build/i/f91187675750791b652f7e129b374c2b682d7cc0e9dbc28def58ffdf66508867.jpg `,
            output: [
                {
                    text:
                        "https://nostr.build/i/f91187675750791b652f7e129b374c2b682d7cc0e9dbc28def58ffdf66508867.jpg",
                    type: "url",
                },
                {
                    text: " ",
                    type: "normal",
                },
            ],
        },
        {
            input:
                ` https://nostr.build/i/f91187675750791b652f7e129b374c2b682d7cc0e9dbc28def58ffdf66508867.jpg `,
            output: [{
                text: " ",
                type: "normal",
            }, {
                text:
                    "https://nostr.build/i/f91187675750791b652f7e129b374c2b682d7cc0e9dbc28def58ffdf66508867.jpg",
                type: "url",
            }, {
                text: " ",
                type: "normal",
            }],
        },
        {
            input: `Hi https://some.jpg`,
            output: [
                {
                    text: "Hi ",
                    type: "normal",
                },
                {
                    text: "https://some.jpg",
                    type: "url",
                },
            ],
        },
        {
            input: `Hi https://some.jpg http://some.jpg`,
            output: [{
                text: "Hi ",
                type: "normal",
            }, {
                text: "https://some.jpg",
                type: "url",
            }, {
                text: " ",
                type: "normal",
            }, {
                text: "http://some.jpg",
                type: "url",
            }],
        },
        {
            input: `npub17dxnfw2vrhgtk4fgqdmpuqxv05u9raau3w0shay7msmr0dzs4m7s6ng4yl`,
            output: [{
                text: "npub17dxnfw2vrhgtk4fgqdmpuqxv05u9raau3w0shay7msmr0dzs4m7s6ng4yl",
                type: "npub",
            }],
        },
        {
            input: `nostr:npub17dxnfw2vrhgtk4fgqdmpuqxv05u9raau3w0shay7msmr0dzs4m7s6ng4ylログボ`,
            output: [{
                text: "nostr:npub17dxnfw2vrhgtk4fgqdmpuqxv05u9raau3w0shay7msmr0dzs4m7s6ng4yl",
                type: "npub",
            }, {
                text: "ログボ",
                type: "normal",
            }],
        },
        {
            input: `sherryiscutenpub17dxnfw2vrhgtk4fgqdmpuqxv05u9raau3w0shay7msmr0dzs4m7s6ng4ylログボ`,
            output: [{
                text: "sherryiscute",
                type: "normal",
            }, {
                text: "npub17dxnfw2vrhgtk4fgqdmpuqxv05u9raau3w0shay7msmr0dzs4m7s6ng4yl",
                type: "npub",
            }, {
                text: "ログボ",
                type: "normal",
            }],
        },

        {
            input:
                `nostr:nprofile1qqsf37u9q4up37etd4w4fgdfkxvurxk74gcmsf9ea0g7vgyasfdjeycpp4mhxue69uhkummn9ekx7mqpz3mhxue69uhhyetvv9ujuerpd46hxtnfduqscamnwvaz7tmzwf3zu6t0qyd8wumn8ghj7mn0wd68ytn0wfskuem9wp5kcmpwv3jhvqghwaehxw309aex2mrp0yhxxatjwfjkuapwveukjqgswaehxw309ahx7um5wgh8w6twv5q3samnwvaz7tmjv4kxz7fwwdhx7un59eek7cmfv9kqz9thwden5te0v4jx2m3wdehhxarj9ekxzmnyqyd8wumn8ghj7un9d3shjtnwdaehgun8wfshq6pwdejhgqgewaehxw309ac82unpwe5kgcfwdehhxarj9ekxzmnyqyvhwumn8ghj7mn0wd68ytn6v43x2er9v5hxxmr0w4jqzynhwden5te0wp6hyurvv4cxzeewv4esz9nhwden5te0v96xcctn9ehx7um5wghxcctwvsq3camnwvaz7tmwdaehgu3wd46hg6tw09mkzmrvv46zucm0d5lxp0l4`,
            output: [{
                type: "nprofile",
                text:
                    "nostr:nprofile1qqsf37u9q4up37etd4w4fgdfkxvurxk74gcmsf9ea0g7vgyasfdjeycpp4mhxue69uhkummn9ekx7mqpz3mhxue69uhhyetvv9ujuerpd46hxtnfduqscamnwvaz7tmzwf3zu6t0qyd8wumn8ghj7mn0wd68ytn0wfskuem9wp5kcmpwv3jhvqghwaehxw309aex2mrp0yhxxatjwfjkuapwveukjqgswaehxw309ahx7um5wgh8w6twv5q3samnwvaz7tmjv4kxz7fwwdhx7un59eek7cmfv9kqz9thwden5te0v4jx2m3wdehhxarj9ekxzmnyqyd8wumn8ghj7un9d3shjtnwdaehgun8wfshq6pwdejhgqgewaehxw309ac82unpwe5kgcfwdehhxarj9ekxzmnyqyvhwumn8ghj7mn0wd68ytn6v43x2er9v5hxxmr0w4jqzynhwden5te0wp6hyurvv4cxzeewv4esz9nhwden5te0v96xcctn9ehx7um5wghxcctwvsq3camnwvaz7tmwdaehgu3wd46hg6tw09mkzmrvv46zucm0d5lxp0l4",
            }],
        },
        {
            input:
                `sherryiscutenprofile1qqsf37u9q4up37etd4w4fgdfkxvurxk74gcmsf9ea0g7vgyasfdjeycpp4mhxue69uhkummn9ekx7mqpz3mhxue69uhhyetvv9ujuerpd46hxtnfduqscamnwvaz7tmzwf3zu6t0qyd8wumn8ghj7mn0wd68ytn0wfskuem9wp5kcmpwv3jhvqghwaehxw309aex2mrp0yhxxatjwfjkuapwveukjqgswaehxw309ahx7um5wgh8w6twv5q3samnwvaz7tmjv4kxz7fwwdhx7un59eek7cmfv9kqz9thwden5te0v4jx2m3wdehhxarj9ekxzmnyqyd8wumn8ghj7un9d3shjtnwdaehgun8wfshq6pwdejhgqgewaehxw309ac82unpwe5kgcfwdehhxarj9ekxzmnyqyvhwumn8ghj7mn0wd68ytn6v43x2er9v5hxxmr0w4jqzynhwden5te0wp6hyurvv4cxzeewv4esz9nhwden5te0v96xcctn9ehx7um5wghxcctwvsq3camnwvaz7tmwdaehgu3wd46hg6tw09mkzmrvv46zucm0d5lxp0l4 123`,
            output: [{
                text: "sherryiscute",
                type: "normal",
            }, {
                type: "nprofile",
                text:
                    "nprofile1qqsf37u9q4up37etd4w4fgdfkxvurxk74gcmsf9ea0g7vgyasfdjeycpp4mhxue69uhkummn9ekx7mqpz3mhxue69uhhyetvv9ujuerpd46hxtnfduqscamnwvaz7tmzwf3zu6t0qyd8wumn8ghj7mn0wd68ytn0wfskuem9wp5kcmpwv3jhvqghwaehxw309aex2mrp0yhxxatjwfjkuapwveukjqgswaehxw309ahx7um5wgh8w6twv5q3samnwvaz7tmjv4kxz7fwwdhx7un59eek7cmfv9kqz9thwden5te0v4jx2m3wdehhxarj9ekxzmnyqyd8wumn8ghj7un9d3shjtnwdaehgun8wfshq6pwdejhgqgewaehxw309ac82unpwe5kgcfwdehhxarj9ekxzmnyqyvhwumn8ghj7mn0wd68ytn6v43x2er9v5hxxmr0w4jqzynhwden5te0wp6hyurvv4cxzeewv4esz9nhwden5te0v96xcctn9ehx7um5wghxcctwvsq3camnwvaz7tmwdaehgu3wd46hg6tw09mkzmrvv46zucm0d5lxp0l4",
            }, {
                text: " 123",
                type: "normal",
            }],
        },
        {
            input:
                `nprofile1qqsf37u9q4up37etd4w4fgdfkxvurxk74gcmsf9ea0g7vgyasfdjeycpp4mhxue69uhkummn9ekx7mqpz3mhxue69uhhyetvv9ujuerpd46hxtnfduqscamnwvaz7tmzwf3zu6t0qyd8wumn8ghj7mn0wd68ytn0wfskuem9wp5kcmpwv3jhvqghwaehxw309aex2mrp0yhxxatjwfjkuapwveukjqgswaehxw309ahx7um5wgh8w6twv5q3samnwvaz7tmjv4kxz7fwwdhx7un59eek7cmfv9kqz9thwden5te0v4jx2m3wdehhxarj9ekxzmnyqyd8wumn8ghj7un9d3shjtnwdaehgun8wfshq6pwdejhgqgewaehxw309ac82unpwe5kgcfwdehhxarj9ekxzmnyqyvhwumn8ghj7mn0wd68ytn6v43x2er9v5hxxmr0w4jqzynhwden5te0wp6hyurvv4cxzeewv4esz9nhwden5te0v96xcctn9ehx7um5wghxcctwvsq3camnwvaz7tmwdaehgu3wd46hg6tw09mkzmrvv46zucm0d5lxp0l4`,
            output: [{
                type: "nprofile",
                text:
                    "nprofile1qqsf37u9q4up37etd4w4fgdfkxvurxk74gcmsf9ea0g7vgyasfdjeycpp4mhxue69uhkummn9ekx7mqpz3mhxue69uhhyetvv9ujuerpd46hxtnfduqscamnwvaz7tmzwf3zu6t0qyd8wumn8ghj7mn0wd68ytn0wfskuem9wp5kcmpwv3jhvqghwaehxw309aex2mrp0yhxxatjwfjkuapwveukjqgswaehxw309ahx7um5wgh8w6twv5q3samnwvaz7tmjv4kxz7fwwdhx7un59eek7cmfv9kqz9thwden5te0v4jx2m3wdehhxarj9ekxzmnyqyd8wumn8ghj7un9d3shjtnwdaehgun8wfshq6pwdejhgqgewaehxw309ac82unpwe5kgcfwdehhxarj9ekxzmnyqyvhwumn8ghj7mn0wd68ytn6v43x2er9v5hxxmr0w4jqzynhwden5te0wp6hyurvv4cxzeewv4esz9nhwden5te0v96xcctn9ehx7um5wghxcctwvsq3camnwvaz7tmwdaehgu3wd46hg6tw09mkzmrvv46zucm0d5lxp0l4",
            }],
        },
        {
            input:
                `naddr1qqxnzd3exsmnjvphxqunqv33qgsp7hwmlh5zccs55shzpfued50pznvypj0wwzn00dtyjzlqkr04w4grqsqqqa28vct2px`,
            output: [{
                type: "naddr",
                text:
                    "naddr1qqxnzd3exsmnjvphxqunqv33qgsp7hwmlh5zccs55shzpfued50pznvypj0wwzn00dtyjzlqkr04w4grqsqqqa28vct2px",
            }],
        },
        {
            input:
                `nostr:nevent1qqsz25j8nrppstgmyry8hgsg4fggtfa6xnym2n4c2xth7usxtydtgpcpp4mhxue69uhhjctzw5hx6egzyze7g05vclndlu36x0vjzw37jykcjkcu8ep9qfqwpjvahmlrq6947qcyqqqqqqgj5mjek`,
            output: [{
                text:
                    "nostr:nevent1qqsz25j8nrppstgmyry8hgsg4fggtfa6xnym2n4c2xth7usxtydtgpcpp4mhxue69uhhjctzw5hx6egzyze7g05vclndlu36x0vjzw37jykcjkcu8ep9qfqwpjvahmlrq6947qcyqqqqqqgj5mjek",
                type: "nevent",
            }],
        },
        {
            input: `Thank you #[0]​ #[2]#[3]`,
            output: [
                {
                    type: "normal",
                    text: "Thank you ",
                },
                {
                    type: "tag",
                    text: "#[0]",
                },
                {
                    type: "normal",
                    text: "​ ",
                },
                {
                    type: "tag",
                    text: "#[2]",
                },
                {
                    type: "tag",
                    text: "#[3]",
                },
            ],
        },
        {
            input:
                `nostr:npub17dxnfw2vrhgtk4fgqdmpuqxv05u9raau3w0shay7msmr0dzs4m7s6ng4yl https://example.com`,
            output: [
                {
                    type: "npub",
                    text: "nostr:npub17dxnfw2vrhgtk4fgqdmpuqxv05u9raau3w0shay7msmr0dzs4m7s6ng4yl",
                },
                {
                    type: "normal",
                    text: " ",
                },
                {
                    type: "url",
                    text: "https://example.com",
                },
            ],
        },
        {
            input:
                `hi https://example.com nostr:npub17dxnfw2vrhgtk4fgqdmpuqxv05u9raau3w0shay7msmr0dzs4m7s6ng4yl`,
            output: [
                {
                    type: "normal",
                    text: "hi ",
                },
                {
                    type: "url",
                    text: "https://example.com",
                },
                {
                    type: "normal",
                    text: " ",
                },
                {
                    type: "npub",
                    text: "nostr:npub17dxnfw2vrhgtk4fgqdmpuqxv05u9raau3w0shay7msmr0dzs4m7s6ng4yl",
                },
            ],
        },
    ];
    for (const test of data) {
        await t.step(`t-${test.input}`, () => {
            assertEquals(test.output, parseContent(test.input));
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
                kind: NostrKind.DIRECT_MESSAGE,
                pubkey: "",
                sig: "",
                tags: [],
                parsedTags: {
                    e: [],
                    p: [],
                },
                publicKey: PrivateKey.Generate().toPublicKey(),
                decryptedContent: "",
            },
            author: PrivateKey.Generate().toPublicKey(),
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

Deno.test("if there is no message, should not yield any group", () => {
    const group = groupContinuousMessages([], () => true).next();
    assertEquals(group.value, undefined);
    assertEquals(group.done, true);
});

Deno.test("findUrlInString should include non-URL parts", () => {
    const result = findUrlInString("Visit http://example.com for more info.");
    assertEquals(result, ["Visit ", new URL("http://example.com"), " for more info."]);
});

Deno.test("findUrlInString with multiple URLs and text parts", () => {
    const result = findUrlInString("Go to http://example.com and https://example.org for info.");
    assertEquals(result, [
        "Go to ",
        new URL("http://example.com"),
        " and ",
        new URL("https://example.org"),
        " for info.",
    ]);
});

Deno.test("findUrlInString with only text", () => {
    const result = findUrlInString("No URLs here.");
    assertEquals(result, ["No URLs here."]);
});
