import sift from "sift";
import { StoryEvent } from "../lib/engine/StoryTypes";
import { expect } from "./TestUtils";

function createStoryEvent(
  from: string,
  to: string,
  body: string,
  time: number,
  nodeType: string = "p",
  addr: string = "0.0",
  tags: string[] = [],
  obs: string[] = []
): StoryEvent {
  return {
    node: {
      type: nodeType,
      addr,
      atts: {},
    },
    from,
    to,
    obs,
    body,
    tags,
    time,
  };
}

async function testBasicFiltering() {
  const events: StoryEvent[] = [
    createStoryEvent("player", "bill", "Hello Bill, how are you?", 1000),
    createStoryEvent(
      "bill",
      "player",
      "I'm doing well, thanks for asking!",
      1001
    ),
    createStoryEvent("player", "bill", "What's your favorite color?", 1002),
    createStoryEvent("bill", "player", "I like blue. What about you?", 1003),
    createStoryEvent("player", "bill", "I prefer red.", 1004),
    createStoryEvent("bill", "player", "Red is nice too!", 1005),
    createStoryEvent("system", "player", "Bill nods approvingly.", 1006),
    createStoryEvent("player", "system", "Look around the room.", 1007),
  ];

  const playerToBill = events.filter(sift({ from: "player", to: "bill" }));
  expect(playerToBill.length, 3);
  expect(playerToBill[0].body, "Hello Bill, how are you?");

  const billToPlayer = events.filter(sift({ from: "bill", to: "player" }));
  expect(billToPlayer.length, 3);
  expect(billToPlayer[0].body, "I'm doing well, thanks for asking!");

  const systemEvents = events.filter(sift({ from: "system" }));
  expect(systemEvents.length, 1);
  expect(systemEvents[0].body, "Bill nods approvingly.");
}

async function testAndConditions() {
  const events: StoryEvent[] = [
    createStoryEvent("player", "bill", "Are you ready?", 2000, "p", "0.0", [
      "question",
    ]),
    createStoryEvent("bill", "player", "Yes, I'm ready!", 2001, "p", "0.1", [
      "response",
    ]),
    createStoryEvent("player", "bill", "Great!", 2002, "p", "0.2", [
      "exclamation",
    ]),
    createStoryEvent("bill", "player", "Let's go then.", 2003, "p", "0.3", [
      "action",
    ]),
    createStoryEvent(
      "player",
      "narrator",
      "I follow Bill.",
      2004,
      "action",
      "0.4",
      ["action"]
    ),
    createStoryEvent(
      "narrator",
      "player",
      "You both head towards the door.",
      2005,
      "p",
      "0.5",
      ["narrative"]
    ),
  ];

  const playerToBillQuestions = events.filter(
    sift({
      $and: [
        { from: "player" },
        { to: "bill" },
        { tags: { $in: ["question"] } },
      ],
    })
  );
  expect(playerToBillQuestions.length, 1);
  expect(playerToBillQuestions[0].body, "Are you ready?");

  const billResponses = events.filter(
    sift({
      $and: [
        { from: "bill" },
        { to: "player" },
        { tags: { $in: ["response", "action"] } },
      ],
    })
  );
  expect(billResponses.length, 2);
  expect(billResponses[0].body, "Yes, I'm ready!");
  expect(billResponses[1].body, "Let's go then.");
}

async function testOrConditions() {
  const events: StoryEvent[] = [
    createStoryEvent("player", "bill", "Do you want coffee or tea?", 3000),
    createStoryEvent("bill", "player", "Coffee, please.", 3001),
    createStoryEvent("narrator", "player", "Bill smiles warmly.", 3002),
    createStoryEvent("player", "bill", "Here you go.", 3003),
    createStoryEvent("bill", "narrator", "Thanks!", 3004),
    createStoryEvent("system", "all", "A bell rings in the distance.", 3005),
    createStoryEvent("player", "narrator", "I wonder what that was.", 3006),
    createStoryEvent("narrator", "bill", "Just the town clock.", 3007),
  ];

  const playerOrBillEvents = events.filter(
    sift({
      $or: [{ from: "player" }, { from: "bill" }],
    })
  );
  expect(playerOrBillEvents.length, 5);

  const narratorOrSystemEvents = events.filter(
    sift({
      $or: [{ from: "narrator" }, { from: "system" }],
    })
  );
  expect(narratorOrSystemEvents.length, 3);

  const toBillOrNarrator = events.filter(
    sift({
      $or: [{ to: "bill" }, { to: "narrator" }],
    })
  );
  expect(toBillOrNarrator.length, 5);
}

async function testComplexAndOrConditions() {
  const events: StoryEvent[] = [
    createStoryEvent("player", "bill", "What's the plan?", 4000, "p", "0.0", [
      "question",
    ]),
    createStoryEvent(
      "bill",
      "player",
      "We need to find the key.",
      4001,
      "p",
      "0.1",
      ["plan"]
    ),
    createStoryEvent(
      "player",
      "narrator",
      "I nod in agreement.",
      4002,
      "action",
      "0.2",
      ["action"]
    ),
    createStoryEvent(
      "narrator",
      "player",
      "Bill points to the locked door.",
      4003,
      "p",
      "0.3",
      ["description"]
    ),
    createStoryEvent(
      "bill",
      "narrator",
      "The key should be around here somewhere.",
      4004,
      "p",
      "0.4",
      ["plan"]
    ),
    createStoryEvent(
      "system",
      "all",
      "You hear footsteps approaching.",
      4005,
      "p",
      "0.5",
      ["audio", "warning"]
    ),
    createStoryEvent("player", "bill", "Someone's coming!", 4006, "p", "0.6", [
      "warning",
      "exclamation",
    ]),
    createStoryEvent("bill", "player", "Quick, hide!", 4007, "p", "0.7", [
      "urgent",
      "action",
    ]),
  ];

  const conversationEvents = events.filter(
    sift({
      $and: [
        {
          $or: [
            { from: "player", to: "bill" },
            { from: "bill", to: "player" },
          ],
        },
        {
          $or: [{ tags: { $in: ["question"] } }, { tags: { $in: ["plan"] } }],
        },
      ],
    })
  );
  expect(conversationEvents.length, 2);
  expect(conversationEvents[0].body, "What's the plan?");
  expect(conversationEvents[1].body, "We need to find the key.");

  const urgentOrWarningEvents = events.filter(
    sift({
      $or: [
        {
          $and: [
            { tags: { $in: ["warning"] } },
            { from: { $in: ["player", "system"] } },
          ],
        },
        {
          $and: [{ tags: { $in: ["urgent"] } }, { from: "bill" }],
        },
      ],
    })
  );
  expect(urgentOrWarningEvents.length, 3);

  const playerToBillOrNarratorEvents = events.filter(
    sift({
      $and: [
        { from: "player" },
        {
          $or: [{ to: "bill" }, { to: "narrator" }],
        },
      ],
    })
  );
  expect(playerToBillOrNarratorEvents.length, 3);
}

async function testDialogBetweenBillAndPlayer() {
  const events: StoryEvent[] = [
    createStoryEvent("player", "bill", "Hey Bill, what's up?", 1000),
    createStoryEvent("bill", "player", "Not much, just thinking.", 1001),
    createStoryEvent("player", "narrator", "I look around the room.", 1002),
    createStoryEvent("narrator", "player", "The room is dimly lit.", 1003),
    createStoryEvent("bill", "narrator", "Bill scratches his head.", 1004),
    createStoryEvent("player", "bill", "Want to go outside?", 1005),
    createStoryEvent("bill", "player", "Sure, let's do it.", 1006),
    createStoryEvent("system", "all", "A door creaks open.", 1007),
    createStoryEvent("player", "system", "Open the door.", 1008),
    createStoryEvent("bill", "system", "Follow the player.", 1009),
    createStoryEvent("bill", "player", "After you.", 1010),
  ];

  const billPlayerDialog = events.filter(
    sift({
      $or: [
        { from: "player", to: "bill" },
        { from: "bill", to: "player" },
      ],
    })
  );
  expect(billPlayerDialog.length, 5);
  expect(billPlayerDialog[0].body, "Hey Bill, what's up?");
  expect(billPlayerDialog[1].body, "Not much, just thinking.");
  expect(billPlayerDialog[2].body, "Want to go outside?");
  expect(billPlayerDialog[3].body, "Sure, let's do it.");
  expect(billPlayerDialog[4].body, "After you.");

  const nonDialogEvents = events.filter(
    sift({
      $and: [
        {
          $not: {
            $or: [
              { from: "player", to: "bill" },
              { from: "bill", to: "player" },
            ],
          },
        },
      ],
    })
  );
  expect(nonDialogEvents.length, 6);
}

async function testTimeRangeFiltering() {
  const events: StoryEvent[] = [
    createStoryEvent("player", "bill", "Good morning!", 1000),
    createStoryEvent("bill", "player", "Morning! Sleep well?", 1500),
    createStoryEvent("player", "bill", "Not really.", 2000),
    createStoryEvent("bill", "player", "Sorry to hear that.", 2500),
    createStoryEvent("player", "bill", "It's fine, let's get going.", 3000),
    createStoryEvent("bill", "player", "Alright, ready when you are.", 3500),
  ];

  const earlyConversation = events.filter(
    sift({
      $and: [
        { time: { $lte: 2000 } },
        {
          $or: [
            { from: "player", to: "bill" },
            { from: "bill", to: "player" },
          ],
        },
      ],
    })
  );
  expect(earlyConversation.length, 3);

  const laterEvents = events.filter(
    sift({
      $and: [{ time: { $gt: 2000 } }, { from: "bill" }],
    })
  );
  expect(laterEvents.length, 2);
  expect(laterEvents[0].body, "Sorry to hear that.");
  expect(laterEvents[1].body, "Alright, ready when you are.");
}

async function run() {
  await testBasicFiltering();
  await testAndConditions();
  await testOrConditions();
  await testComplexAndOrConditions();
  await testDialogBetweenBillAndPlayer();
  await testTimeRangeFiltering();
}

run()
  .then(() => {
    console.log("✓ sift.test.ts passed");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
