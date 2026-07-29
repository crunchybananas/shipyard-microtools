# A2 Interchange Source Concepts

These four sheets are offline painted inputs for RFC 0002's A2 factorial proof.
They are not runtime assets and do not own pose, scale, frame order, sockets,
occlusion, semantic masks, row packing, or atlas registration.

Generated on 2026-07-18 with the built-in image-generation tool. The existing
guard and builder concept sheets were style/layout references only. Generation
used a flat green chroma background; `remove_chroma_key.py` produced the
transparent project sources. The `*-keyed.png` files are retained as generation
provenance until A2 council closure, while the deterministic compiler consumes
only the transparent PNGs.

| Domain | Transparent source | SHA-256 |
| --- | --- | --- |
| Identity A | `identity-watchman.png` | `6ffc68e673e04384f072575279fd76b0d2024b1db55efd9da3019d6a734ff2ca` |
| Identity B | `identity-craftsperson.png` | `fa6b11610b0e5cf67ae1c752a1ee7ecf39f462f0b2a74ed2e6af8af4549152bd` |
| Garment A | `garment-watch-blue.png` | `f17117625526aee6a965f5d8ca51ead9abfee4fd5aa3882c7e62cb74c01b9fc6` |
| Garment B | `garment-ochre-work.png` | `a01506add562cfcd5bcc54fc86a64728fd7febc7bc600515bfc88b89db3f07e4` |

## Prompt set

All prompts included the following shared production constraints:

- Realm offline 2D skeletal sprite-compiler component sheet;
- polished hand-painted native pixel art matching the existing concepts;
- clean, non-overlapping orthographic front/back/left components;
- readable at a `64x84` actor scale;
- no vector/SVG look, text, labels, watermark, cast shadow, or assembled actor;
- a perfectly flat `#00ff00` chroma background with no texture or lighting
  variation.

Identity A requested a broad-shouldered frontier watchman with a square face,
short dark hair and moustache, warm medium skin, neutral brown underlayer,
unhelmeted three-view head, three-view torso, bare arms/hands, and neutral
leg/boot bases. It explicitly excluded all profession clothing and equipment.

Identity B requested a lean frontier craftsperson with a narrow face, swept
auburn hair and short beard, warm light skin, charcoal underlayer, unhelmeted
three-view head, three-view torso, bare arms/hands, and neutral leg/boot bases.
It explicitly excluded all profession clothing and equipment.

Garment A requested clothing-only watch-blue workwear: empty steel helmet
shells, empty blue tunic shells, sleeve shells, trouser/boot shells, and a belt.
It explicitly excluded body, face, hair, skin, hands, sword, pouch, load, and
tools so either identity can wear the kit.

Garment B requested clothing-only ochre craft workwear: empty cap shells,
empty moss-shirt/ochre-apron shells, rolled sleeve shells, reinforced
trouser/boot shells, and a tool belt without tools or pouches. It explicitly
excluded body, face, hair, skin, hands, attachments, and tools so either
identity can wear the kit.

The compiler must still prove that these declarations correspond to independent
pixel contribution planes. Merely storing the sheets in separate files is not
an interchangeability gate.
