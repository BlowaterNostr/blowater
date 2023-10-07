import { assertEquals } from "https://deno.land/std@0.176.0/testing/asserts.ts";
import { ChatMessage, groupContinuousMessages, parseContent } from "./message.ts";
import { PrivateKey, PublicKey } from "../lib/nostr-ts/key.ts";
import { Nevent, NostrAddress } from "../lib/nostr-ts/nip19.ts";
import { NostrKind } from "../lib/nostr-ts/nostr.ts";

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
                pubkey: PublicKey.FromHex("f34d34b94c1dd0bb552803761e00cc7d3851f7bc8b9f0bf49edc3637b450aefd"),
                start: 0,
                end: 68,
            }],
        },
        {
            input: `sherryiscutenpub17dxnfw2vrhgtk4fgqdmpuqxv05u9raau3w0shay7msmr0dzs4m7s6ng4ylログボ`,
            output: [{
                type: "npub",
                pubkey: PublicKey.FromHex("f34d34b94c1dd0bb552803761e00cc7d3851f7bc8b9f0bf49edc3637b450aefd"),
                start: 12,
                end: 74,
            }],
        },
        {
            input: `npub17dxnfw2vrhgtk4fgqdmpuqxv05u9raau3w0shay7msmr0dzs4m7s6ng4yl`,
            output: [{
                type: "npub",
                pubkey: PublicKey.FromHex("f34d34b94c1dd0bb552803761e00cc7d3851f7bc8b9f0bf49edc3637b450aefd"),
                start: 0,
                end: 62,
            }],
        },
        {
            input:
                `nostr:nprofile1qqsf37u9q4up37etd4w4fgdfkxvurxk74gcmsf9ea0g7vgyasfdjeycpp4mhxue69uhkummn9ekx7mqpz3mhxue69uhhyetvv9ujuerpd46hxtnfduqscamnwvaz7tmzwf3zu6t0qyd8wumn8ghj7mn0wd68ytn0wfskuem9wp5kcmpwv3jhvqghwaehxw309aex2mrp0yhxxatjwfjkuapwveukjqgswaehxw309ahx7um5wgh8w6twv5q3samnwvaz7tmjv4kxz7fwwdhx7un59eek7cmfv9kqz9thwden5te0v4jx2m3wdehhxarj9ekxzmnyqyd8wumn8ghj7un9d3shjtnwdaehgun8wfshq6pwdejhgqgewaehxw309ac82unpwe5kgcfwdehhxarj9ekxzmnyqyvhwumn8ghj7mn0wd68ytn6v43x2er9v5hxxmr0w4jqzynhwden5te0wp6hyurvv4cxzeewv4esz9nhwden5te0v96xcctn9ehx7um5wghxcctwvsq3camnwvaz7tmwdaehgu3wd46hg6tw09mkzmrvv46zucm0d5lxp0l4`,
            output: [{
                type: "npub",
                pubkey: PublicKey.FromHex("98fb85057818fb2b6d5d54a1a9b199c19adeaa31b824b9ebd1e6209d825b2c93"),
                start: 0,
                end: 598,
                relays: [
                    "wss://nos.lol",
                    "wss://relay.damus.io",
                    "wss://brb.io",
                    "wss://nostr.orangepill.dev",
                    "wss://relay.current.fyi",
                    "wss://nostr.wine",
                    "wss://relay.snort.social",
                    "wss://eden.nostr.land",
                    "wss://relay.nostrgraph.net",
                    "wss://puravida.nostr.land",
                    "wss://nostr.zebedee.cloud",
                    "wss://purplepag.es",
                    "wss://atlas.nostr.land",
                    "wss://nostr.mutinywallet.com",
                ],
            }],
        },
        {
            input:
                `sherryiscutenprofile1qqsf37u9q4up37etd4w4fgdfkxvurxk74gcmsf9ea0g7vgyasfdjeycpp4mhxue69uhkummn9ekx7mqpz3mhxue69uhhyetvv9ujuerpd46hxtnfduqscamnwvaz7tmzwf3zu6t0qyd8wumn8ghj7mn0wd68ytn0wfskuem9wp5kcmpwv3jhvqghwaehxw309aex2mrp0yhxxatjwfjkuapwveukjqgswaehxw309ahx7um5wgh8w6twv5q3samnwvaz7tmjv4kxz7fwwdhx7un59eek7cmfv9kqz9thwden5te0v4jx2m3wdehhxarj9ekxzmnyqyd8wumn8ghj7un9d3shjtnwdaehgun8wfshq6pwdejhgqgewaehxw309ac82unpwe5kgcfwdehhxarj9ekxzmnyqyvhwumn8ghj7mn0wd68ytn6v43x2er9v5hxxmr0w4jqzynhwden5te0wp6hyurvv4cxzeewv4esz9nhwden5te0v96xcctn9ehx7um5wghxcctwvsq3camnwvaz7tmwdaehgu3wd46hg6tw09mkzmrvv46zucm0d5lxp0l4 123`,
            output: [{
                type: "npub",
                pubkey: PublicKey.FromHex("98fb85057818fb2b6d5d54a1a9b199c19adeaa31b824b9ebd1e6209d825b2c93"),
                start: 12,
                end: 604,
                relays: [
                    "wss://nos.lol",
                    "wss://relay.damus.io",
                    "wss://brb.io",
                    "wss://nostr.orangepill.dev",
                    "wss://relay.current.fyi",
                    "wss://nostr.wine",
                    "wss://relay.snort.social",
                    "wss://eden.nostr.land",
                    "wss://relay.nostrgraph.net",
                    "wss://puravida.nostr.land",
                    "wss://nostr.zebedee.cloud",
                    "wss://purplepag.es",
                    "wss://atlas.nostr.land",
                    "wss://nostr.mutinywallet.com",
                ],
            }],
        },
        {
            input:
                `nprofile1qqsf37u9q4up37etd4w4fgdfkxvurxk74gcmsf9ea0g7vgyasfdjeycpp4mhxue69uhkummn9ekx7mqpz3mhxue69uhhyetvv9ujuerpd46hxtnfduqscamnwvaz7tmzwf3zu6t0qyd8wumn8ghj7mn0wd68ytn0wfskuem9wp5kcmpwv3jhvqghwaehxw309aex2mrp0yhxxatjwfjkuapwveukjqgswaehxw309ahx7um5wgh8w6twv5q3samnwvaz7tmjv4kxz7fwwdhx7un59eek7cmfv9kqz9thwden5te0v4jx2m3wdehhxarj9ekxzmnyqyd8wumn8ghj7un9d3shjtnwdaehgun8wfshq6pwdejhgqgewaehxw309ac82unpwe5kgcfwdehhxarj9ekxzmnyqyvhwumn8ghj7mn0wd68ytn6v43x2er9v5hxxmr0w4jqzynhwden5te0wp6hyurvv4cxzeewv4esz9nhwden5te0v96xcctn9ehx7um5wghxcctwvsq3camnwvaz7tmwdaehgu3wd46hg6tw09mkzmrvv46zucm0d5lxp0l4`,
            output: [{
                type: "npub",
                pubkey: PublicKey.FromHex("98fb85057818fb2b6d5d54a1a9b199c19adeaa31b824b9ebd1e6209d825b2c93"),
                start: 0,
                end: 592,
                relays: [
                    "wss://nos.lol",
                    "wss://relay.damus.io",
                    "wss://brb.io",
                    "wss://nostr.orangepill.dev",
                    "wss://relay.current.fyi",
                    "wss://nostr.wine",
                    "wss://relay.snort.social",
                    "wss://eden.nostr.land",
                    "wss://relay.nostrgraph.net",
                    "wss://puravida.nostr.land",
                    "wss://nostr.zebedee.cloud",
                    "wss://purplepag.es",
                    "wss://atlas.nostr.land",
                    "wss://nostr.mutinywallet.com",
                ],
            }],
        },
        {
            input:
                `naddr1qqxnzd3exsmnjvphxqunqv33qgsp7hwmlh5zccs55shzpfued50pznvypj0wwzn00dtyjzlqkr04w4grqsqqqa28vct2px`,
            output: [{
                type: "naddr",
                start: 0,
                end: 99,
                addr: new NostrAddress({
                    pubkey: PublicKey.FromHex(
                        "1f5ddbfde82c6214a42e20a7996d1e114d840c9ee70a6f7b56490be0b0df5755",
                    ) as PublicKey,
                    identifier: "1694790709021",
                    kind: NostrKind.Long_Form,
                    relays: [],
                }),
            }],
        },
        {
            input:
                `nostr:nevent1qqsz25j8nrppstgmyry8hgsg4fggtfa6xnym2n4c2xth7usxtydtgpcpp4mhxue69uhhjctzw5hx6egzyze7g05vclndlu36x0vjzw37jykcjkcu8ep9qfqwpjvahmlrq6947qcyqqqqqqgj5mjek`,
            output: [{
                end: 161,
                event: new Nevent(
                    {
                        id: "25524798c2182d1b20c87ba208aa5085a7ba34c9b54eb851977f7206591ab407",
                        kind: 1,
                        pubkey: PublicKey.FromHex(
                            "b3e43e8cc7e6dff23a33d9213a3e912d895b1c3e4250240e0c99dbefe3068b5f",
                        ) as PublicKey,
                        relays: [
                            "wss://yabu.me",
                        ],
                    },
                ),
                start: 0,
                type: "nevent",
            }],
        },
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
                kind: NostrKind.DIRECT_MESSAGE,
                pubkey: "",
                sig: "",
                tags: [],
                parsedContentItems: [],
                parsedTags: {
                    e: [],
                    p: [],
                },
                publicKey: PrivateKey.Generate().toPublicKey(),
                decryptedContent: ""
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
