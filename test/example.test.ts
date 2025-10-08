import { readFileSync } from "fs";
import { join } from "path";
import { expect, runTestStory } from "./TestUtils";

async function testExampleStoryPlaythrough() {
  // Load all files from fic/example directory
  const ficPath = join(__dirname, "../fic/example");
  const cartridge = {
    "main.xml": readFileSync(join(ficPath, "main.xml"), "utf-8"),
    "combat.xml": readFileSync(join(ficPath, "combat.xml"), "utf-8"),
    "data.yml": readFileSync(join(ficPath, "data.yml"), "utf-8"),
  };

  // Define input sequence for a successful mage playthrough
  const inputs = [
    // Character creation
    "Alice",                           // Player name
    "mage",                           // Player class
    
    // Entry Hall exploration
    "examine runes",                  // Learn about the puzzle
    "cast spell",                     // Use magic to illuminate runes (mage has magic > 5)
    "try west door",                  // Open the secret door with rune knowledge
    "go north",                       // Move to armory
    
    // Armory combat
    "attack",                         // Combat round 1
    "attack",                         // Combat round 2 (should be enough to defeat goblin)
    "vault",                          // Post-combat: choose to go to vault
    
    // Vault finale
    "carefully",                      // Approach treasure cautiously for best outcome
  ];

  const { ops, seam, session } = await runTestStory(cartridge, inputs);

  // Filter for text content events
  const eventOps = ops.filter((op) => op.type === "play-media");
  const textEvents = eventOps.filter((op) => op.event && op.event.body);
  const textBodies = textEvents.map((e) => e.event!.body.trim());

  console.log("=== FULL STORY PLAYTHROUGH ===");
  textBodies.forEach((text, i) => {
    console.log(`${i + 1}: ${text}`);
  });

  // Key story beats to verify (deterministic content)
  const expectedContent = [
    // Introduction
    /Welcome to The Enchanted Vault/,
    /before the entrance to an ancient dungeon/,
    
    // Character creation
    /Before entering the dungeon.*name/,
    /Greetings, Alice/,
    /choose warrior, mage, or rogue/,
    /You are now a Mage with 60 health.*10 magic/,  // Mage stats from data.yml
    /Arcane energy crackles around your fingers/,    // When condition for magic > 5
    
    // Entry hall
    /You are in the Entry Hall/,
    /Ancient runes cover the walls/,
    /spell illuminates.*runes easier to read/,       // Magic spell effect
    /speak the word "LIGHT".*healing potion/,       // Secret door success
    
    // Armory
    /You are in the Ancient Armory/,
    /Dust-covered weapon racks.*goblin guard/,
    /You search the armory.*enchanted blade/,       // Post-combat success
    /After \d+ minutes.*hidden passage/,            // Scoped variable with deterministic random
    
    // Vault  
    /You are in the Treasure Vault/,
    /Golden coins and precious gems/,
    /You successfully claim.*Skeleton Key/,         // Success ending from careful approach
    
    // Victory
    /Congratulations, Alice.*conquered/,
    /final inventory.*Healing Potion.*Enchanted Blade.*Skeleton Key/,  // Collected items
    /Thank you for playing The Enchanted Vault/,
  ];

  // Verify key story content appears in order
  let contentIndex = 0;
  for (let i = 0; i < expectedContent.length; i++) {
    const pattern = expectedContent[i];
    let found = false;
    
    for (let j = contentIndex; j < textBodies.length; j++) {
      if (pattern.test(textBodies[j])) {
        console.log(`✓ Found expected content: ${pattern.source}`);
        contentIndex = j + 1;
        found = true;
        break;
      }
    }
    
    if (!found) {
      console.error(`❌ Expected content not found: ${pattern.source}`);
      console.error("Remaining text:", textBodies.slice(contentIndex));
      throw new Error(`Missing expected story content: ${pattern.source}`);
    }
  }

  // Verify final session state
  expect(session.state.playerName, "Alice");
  expect(session.state.playerClass, "mage");
  expect(session.state.gameComplete, true);
  expect(session.state.currentRoom, "vault");
  
  // Verify inventory contains expected items
  const inventory = session.state.inventory as string[];
  expect(inventory.includes("healing_potion"), true);
  expect(inventory.includes("magic_sword"), true);
  expect(inventory.includes("skeleton_key"), true);
  
  // Verify mage stats were set correctly
  expect(session.state.health, 60);    // Mage starting health from data.yml
  expect(session.state.magic, 10);     // Mage starting magic from data.yml
  expect(session.state.strength, 3);   // Mage starting strength from data.yml

  // Verify story completed successfully
  expect(seam, "finish");

  // Count different operation types to verify story features
  const playMediaOps = ops.filter(op => op.type === "play-media").length;
  const getInputOps = ops.filter(op => op.type === "get-input").length;
  const musicOps = ops.filter(op => op.type === "play-media" && op.event?.type === "music").length;
  const soundOps = ops.filter(op => op.type === "play-media" && op.event?.type === "sound").length;

  console.log(`\n=== STORY STATISTICS ===`);
  console.log(`Total play-media operations: ${playMediaOps}`);
  console.log(`Total input prompts: ${getInputOps}`);
  console.log(`Music events: ${musicOps}`);
  console.log(`Sound effects: ${soundOps}`);
  
  // Basic sanity checks
  expect(playMediaOps > 20, true);  // Should have substantial content
  expect(getInputOps, inputs.length);  // Should match our input count
  expect(musicOps >= 2, true);      // Intro and outro music
  expect(soundOps >= 3, true);      // Room macro adds sound effects

  console.log("✓ Example story playthrough completed successfully!");
}

// Additional test for failure path
async function testExampleStoryFailurePath() {
  const ficPath = join(__dirname, "../fic/example");
  const cartridge = {
    "main.xml": readFileSync(join(ficPath, "main.xml"), "utf-8"),
    "combat.xml": readFileSync(join(ficPath, "combat.xml"), "utf-8"),  
    "data.yml": readFileSync(join(ficPath, "data.yml"), "utf-8"),
  };

  // Test a warrior who dies in combat
  const inputs = [
    "Bob",           // Player name
    "warrior",       // Player class (high strength, low magic)
    "go north",      // Skip entry hall puzzle, go straight to combat
    "flee",          // Try to flee from combat
    "flee",          // Try to flee again
    "flee",          // Keep trying to flee until it works or we die
  ];

  const { ops, seam, session } = await runTestStory(cartridge, inputs);
  const textEvents = ops.filter((op) => op.type === "play-media" && op.event?.body);
  const textBodies = textEvents.map((e) => e.event!.body.trim());

  // Should see warrior-specific content
  const hasWarriorStats = textBodies.some(text => 
    text.includes("100 health") && text.includes("8 strength") && text.includes("2 magic")
  );
  expect(hasWarriorStats, true);

  // Should see combat content
  const hasCombat = textBodies.some(text => text.includes("goblin guard"));
  expect(hasCombat, true);

  // Should see flee attempts
  const hasFleeAttempt = textBodies.some(text => text.includes("attempt to flee"));
  expect(hasFleeAttempt, true);

  console.log("✓ Example story failure path completed successfully!");
}

async function testExampleStoryResume() {
  const ficPath = join(__dirname, "../fic/example");
  const cartridge = {
    "main.xml": readFileSync(join(ficPath, "main.xml"), "utf-8"),
    "combat.xml": readFileSync(join(ficPath, "combat.xml"), "utf-8"),
    "data.yml": readFileSync(join(ficPath, "data.yml"), "utf-8"),
  };

  // Test resume functionality
  const { ops, session } = await runTestStory(cartridge, [], {
    resume: true,
    turn: 5,  // Simulate returning player
  });

  const textEvents = ops.filter((op) => op.type === "play-media" && op.event?.body);
  const textBodies = textEvents.map((e) => e.event!.body.trim());

  // Should see resume content instead of intro
  const hasResumeContent = textBodies.some(text => text.includes("Welcome back"));
  expect(hasResumeContent, true);

  // Should NOT see intro content
  const hasIntroContent = textBodies.some(text => text.includes("Welcome to The Enchanted Vault"));
  expect(hasIntroContent, false);

  console.log("✓ Example story resume functionality completed successfully!");
}

// Run all tests
async function runAllTests() {
  try {
    await testExampleStoryPlaythrough();
    await testExampleStoryFailurePath();
    await testExampleStoryResume();
    console.log("\n🎉 All example story tests passed!");
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

runAllTests();