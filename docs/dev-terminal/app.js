// The Developer's Journey - A text adventure about AI and coding
const output = document.getElementById('output');
const input = document.getElementById('input');

// Game state
let state = {
  location: 'office',
  inventory: [],
  flags: {
    talkedToBoss: false,
    readArticle: false,
    triedCopilot: false,
    hadCoffee: false,
    talkedToJunior: false,
    talkedToSenior: false,
    builtWithAI: false,
    builtTraditional: false,
    attendedMeeting: false,
    foundPerspective: false,
    ending: null
  },
  chapter: 1,
  mood: 50 // 0 = despair, 100 = optimistic
};

// Locations
const locations = {
  office: {
    name: "Your Desk",
    description: `You sit at your desk in the open-plan office. Three monitors glow with VS Code, Slack, and an endless stream of tech news.

A notification pops up: "GitHub Copilot adoption mandatory starting next month."

Your coffee mug is empty. The office hums with the usual keyboard clatter.`,
    items: ["laptop", "empty coffee mug", "stack of programming books"],
    exits: { north: "kitchen", east: "meeting_room", south: "lobby", west: "senior_desk" }
  },
  kitchen: {
    name: "Office Kitchen",
    description: `The kitchen smells of burnt coffee and ambition. A junior developer, Alex, stares at their phone with a worried expression.

The coffee machine gurgles ominously. A whiteboard shows the sprint burndown chart — you're behind.`,
    items: ["coffee machine", "whiteboard"],
    exits: { south: "office" }
  },
  meeting_room: {
    name: "Glass Meeting Room",
    description: `The meeting room has too many chairs and a TV that never works on the first try.

Through the glass, you can see your manager setting up a presentation titled "AI: Transforming Our Workflow."`,
    items: ["presentation slides", "conference phone"],
    exits: { west: "office" }
  },
  lobby: {
    name: "Office Lobby",
    description: `The lobby is all exposed brick and startup aesthetic. A TV cycles through tech news headlines:

"AI TO REPLACE 40% OF CODING JOBS BY 2027"
"STACKOVERFLOW TRAFFIC DOWN 50%"
"JUNIOR DEVELOPER ROLE: EXTINCT?"

The receptionist doesn't look up from their screen.`,
    items: ["tech news screen", "uncomfortable couch"],
    exits: { north: "office", outside: "park" }
  },
  senior_desk: {
    name: "Senior Developer's Corner",
    description: `Maya's desk is a shrine to computing history — a mechanical keyboard, a rubber duck, stickers from conferences long forgotten.

She's been coding for 25 years. Survived the dot-com bust, the mobile revolution, the cloud migration. Now she's reading something intently.`,
    items: ["rubber duck", "vintage keyboard"],
    exits: { east: "office" }
  },
  park: {
    name: "Nearby Park",
    description: `A small park between office buildings. A few developers eat lunch on benches, laptops balanced on their knees.

The trees don't care about AI. The birds never learned to code in the first place.

A bench sits empty, inviting contemplation.`,
    items: ["park bench", "birds"],
    exits: { inside: "lobby" }
  }
};

// Process commands
function processCommand(cmd) {
  const command = cmd.toLowerCase().trim();
  const words = command.split(' ');
  const verb = words[0];
  const noun = words.slice(1).join(' ');

  // Movement
  if (['go', 'walk', 'move', 'n', 's', 'e', 'w', 'north', 'south', 'east', 'west', 'inside', 'outside'].includes(verb)) {
    return handleMovement(verb === 'go' ? noun : verb);
  }

  // Look
  if (['look', 'l', 'examine', 'read', 'inspect'].includes(verb)) {
    if (!noun || noun === 'around') return describeLook();
    return examineObject(noun);
  }

  // Talk
  if (['talk', 'speak', 'ask', 'chat'].includes(verb)) {
    return handleTalk(noun);
  }

  // Use / interact
  if (['use', 'drink', 'take', 'get', 'try'].includes(verb)) {
    return handleUse(noun);
  }

  // Sit / think
  if (['sit', 'think', 'reflect', 'contemplate'].includes(verb)) {
    return handleThink();
  }

  // Inventory
  if (['inventory', 'inv', 'i'].includes(verb)) {
    return showInventory();
  }

  // Help
  if (['help', '?', 'commands'].includes(verb)) {
    return showHelp();
  }

  // Special commands
  if (command === 'code' || command === 'write code') {
    return handleCoding();
  }

  if (command === 'quit' || command === 'exit') {
    return `<p class="hint">Thanks for playing. Refresh to restart.</p>`;
  }

  return `<p class="error">I don't understand "${cmd}". Type HELP for commands.</p>`;
}

function handleMovement(direction) {
  const dirMap = {
    'n': 'north', 'north': 'north',
    's': 'south', 'south': 'south',
    'e': 'east', 'east': 'east',
    'w': 'west', 'west': 'west',
    'inside': 'inside', 'outside': 'outside'
  };

  const dir = dirMap[direction];
  const exits = locations[state.location].exits;

  if (dir && exits[dir]) {
    state.location = exits[dir];
    return describeLook();
  }

  return `<p class="error">You can't go that way.</p>`;
}

function describeLook() {
  const loc = locations[state.location];
  let text = `<p class="location">${loc.name}</p>`;
  text += `<p class="description">${loc.description}</p>`;
  
  if (loc.items.length > 0) {
    text += `<p class="items">You notice: ${loc.items.join(', ')}</p>`;
  }

  const exits = Object.keys(loc.exits);
  text += `<p class="hint">Exits: ${exits.join(', ')}</p>`;

  return text;
}

function examineObject(obj) {
  const examinations = {
    'laptop': `<p>Your MacBook Pro. The stickers are peeling. You've written thousands of hours of code on this machine.</p>
      <p class="thought">Will it all become obsolete? Will YOU become obsolete?</p>
      <p class="hint">You could TRY COPILOT or WRITE CODE the traditional way.</p>`,
    
    'coffee': () => {
      if (!state.flags.hadCoffee && state.location === 'kitchen') {
        return `<p>The coffee machine hisses. You could USE COFFEE MACHINE.</p>`;
      }
      return `<p>Coffee. The developer's fuel. Your mug is ${state.flags.hadCoffee ? 'warm and comforting' : 'sadly empty'}.</p>`;
    },
    
    'coffee machine': `<p>A temperamental Breville that's seen better days. It still makes decent espresso.</p>
      <p class="hint">USE COFFEE MACHINE to make coffee.</p>`,
    
    'books': `<p>Clean Code. Design Patterns. The Pragmatic Programmer. SICP.</p>
      <p class="thought">You spent years studying these. Learning to think like a programmer. Does that still matter?</p>`,
    
    'programming books': `<p>Clean Code. Design Patterns. The Pragmatic Programmer. SICP.</p>
      <p class="thought">You spent years studying these. Learning to think like a programmer. Does that still matter?</p>`,
    
    'whiteboard': `<p>The burndown chart shows the team is behind by 3 story points. Someone has drawn a sad face.</p>`,
    
    'news': `<p>The headlines scroll endlessly:</p>
      <p class="dialogue">"OPENAI ANNOUNCES GPT-5: 'APPROACHING HUMAN-LEVEL CODING'"</p>
      <p class="dialogue">"TECH LAYOFFS CONTINUE AS COMPANIES EMBRACE AI"</p>
      <p class="dialogue">"BOOTCAMP GRAD LANDS JOB USING ONLY AI TOOLS"</p>
      ${!state.flags.readArticle ? '<p class="hint">READ ARTICLE to read more deeply.</p>' : ''}`,
    
    'tech news': `<p>The headlines scroll endlessly:</p>
      <p class="dialogue">"OPENAI ANNOUNCES GPT-5: 'APPROACHING HUMAN-LEVEL CODING'"</p>
      <p class="dialogue">"TECH LAYOFFS CONTINUE AS COMPANIES EMBRACE AI"</p>`,
    
    'article': () => {
      state.flags.readArticle = true;
      state.mood -= 10;
      return `<p>You read an article: "The End of Programming As We Know It"</p>
        <p class="dialogue">"Within five years, most code will be written by AI. Human programmers will become 'AI supervisors' at best, unemployed at worst..."</p>
        <p class="thought">Your chest tightens. Is this really happening?</p>`;
    },
    
    'presentation': `<p>The slides are titled "Embracing AI: Our Path Forward"</p>
      <p>Slide 1: "AI is not a threat, it's an opportunity!"</p>
      <p>Slide 2: "Productivity gains of 40-60%"</p>
      <p>Slide 3: "New roles: AI Prompt Engineer, AI Code Reviewer"</p>
      <p class="thought">New roles. What happens to the old ones?</p>`,
    
    'rubber duck': `<p>Maya's rubber duck. Battle-scarred from thousands of debugging sessions.</p>
      <p class="thought">You remember when debugging meant talking to a duck, not asking an AI.</p>`,
    
    'bench': `<p>A weathered wooden bench under an oak tree. Someone carved "2015 BOOTCAMP SURVIVORS" into the armrest.</p>
      <p class="hint">You could SIT and THINK here.</p>`,
    
    'birds': `<p>Sparrows hop between breadcrumbs. They have no concept of artificial intelligence, job security, or legacy code.</p>
      <p class="thought">Must be nice.</p>`,
    
    'alex': `<p>Alex looks up nervously. They graduated from a bootcamp six months ago. This is their first developer job.</p>
      <p class="hint">TALK TO ALEX.</p>`,
    
    'maya': `<p>Maya types steadily, her expression calm. 25 years in tech. She's seen trends come and go.</p>
      <p class="hint">TALK TO MAYA.</p>`
  };

  const key = Object.keys(examinations).find(k => obj.includes(k));
  if (key) {
    const result = examinations[key];
    return typeof result === 'function' ? result() : result;
  }

  return `<p>You don't see anything special about that.</p>`;
}

function handleTalk(target) {
  if (target.includes('alex') || target.includes('junior')) {
    if (state.location !== 'kitchen') {
      return `<p>Alex isn't here.</p>`;
    }
    state.flags.talkedToJunior = true;
    state.mood -= 5;
    return `<p class="dialogue">"Hey... did you see that article? About AI replacing junior devs first?"</p>
      <p>Alex's voice wavers.</p>
      <p class="dialogue">"I just got here. I spent a year learning to code. I have student loans. And now they're saying... we're obsolete before we even started?"</p>
      <p class="dialogue">"I used Copilot for the first time yesterday. It wrote my function before I finished typing. It was... terrifying. And amazing. Mostly terrifying."</p>
      <p class="thought">You don't know what to say. You feel it too.</p>`;
  }

  if (target.includes('maya') || target.includes('senior')) {
    if (state.location !== 'senior_desk') {
      return `<p>Maya isn't here.</p>`;
    }
    state.flags.talkedToSenior = true;
    state.mood += 15;
    return `<p>Maya looks up from her screen with a knowing smile.</p>
      <p class="dialogue">"Worried about the AI thing, huh?"</p>
      <p>She leans back.</p>
      <p class="dialogue">"When I started, they said the internet would kill programming. Too easy. Anyone could make a website. Then it was offshore outsourcing — 'Why pay American salaries?' Then no-code tools. 'The end of developers!'"</p>
      <p class="dialogue">"And yet here we are. The job changed. The tools changed. But someone still needs to understand the problem. To debug the weird edge cases. To know when the AI is confidently wrong."</p>
      <p class="dialogue">"The question isn't whether AI can code. It's whether YOU can do what AI can't."</p>
      <p class="hint">Type THINK to reflect on this.</p>`;
  }

  if (target.includes('manager') || target.includes('boss')) {
    if (state.location !== 'meeting_room') {
      return `<p>Your manager isn't here right now. They're probably in the meeting room.</p>`;
    }
    state.flags.talkedToBoss = true;
    state.flags.attendedMeeting = true;
    return `<p>Your manager looks up with aggressive optimism.</p>
      <p class="dialogue">"Great timing! I was just preparing our AI transformation deck. Exciting times, right?"</p>
      <p class="dialogue">"Look, I'll be straight with you. Leadership wants us to ship faster. AI tools are how we do that. The developers who embrace this will thrive. The ones who resist..."</p>
      <p>The sentence hangs unfinished.</p>
      <p class="dialogue">"We need champions. People who can show the team how it's done. Are you in?"</p>
      <p class="thought">Is this opportunity or ultimatum?</p>`;
  }

  return `<p>There's no one here by that name.</p>`;
}

function handleUse(item) {
  if (item.includes('coffee') && state.location === 'kitchen') {
    state.flags.hadCoffee = true;
    state.mood += 5;
    return `<p>The machine hisses and sputters. A minute later, you have a perfect espresso.</p>
      <p>The warmth spreads through your hands. Some things AI can't replicate — the ritual, the pause, the humanity of a simple cup of coffee.</p>
      <p class="success">You feel slightly better.</p>`;
  }

  if (item.includes('copilot') || item.includes('ai')) {
    state.flags.triedCopilot = true;
    return `<p>You enable GitHub Copilot. The ghost text appears, suggesting code before you type.</p>
      <p>You start writing a function. Copilot completes it. It's... correct. Better than what you would have written, maybe.</p>
      <p class="thought">You feel something strange. Relief? Fear? Both?</p>
      <p class="dialogue">The AI doesn't know why this code matters. It doesn't know about the user who'll cry when the bug is fixed. It doesn't know about the 3 AM debugging session that taught you about memory leaks.</p>
      <p class="thought">But does that matter if the code works?</p>`;
  }

  return `<p>You can't use that here.</p>`;
}

function handleCoding() {
  if (state.flags.builtWithAI || state.flags.builtTraditional) {
    return `<p>You've already made your choice for today. Type THINK to reflect.</p>`;
  }

  return `<p>You open VS Code. A ticket awaits: "Implement user export feature."</p>
    <p>Your fingers hover over the keyboard. You could:</p>
    <p class="hint">TYPE "CODE WITH AI" - Use Copilot to generate the solution</p>
    <p class="hint">TYPE "CODE TRADITIONAL" - Write it yourself, the old way</p>`;
}

function handleThink() {
  if (state.location === 'park') {
    state.flags.foundPerspective = true;
    state.mood += 20;
    return `<p>You sit on the bench. The sun filters through the leaves.</p>
      <p class="thought">You think about why you became a programmer.</p>
      <p class="thought">It wasn't about the syntax. It was about solving problems. Building things. The satisfaction of making something work.</p>
      <p class="thought">AI is a tool. The most powerful tool you've ever had. But a tool doesn't have purpose. YOU have purpose.</p>
      <p class="thought">The junior developers need mentors who understand the craft, not just the prompts.</p>
      <p class="thought">The complex systems need architects who see beyond the autocomplete.</p>
      <p class="thought">The weird bugs need debuggers who can read between the lines of confident AI hallucinations.</p>
      <p class="success">A weight lifts. The fear doesn't disappear, but it makes room for something else.</p>
      <p class="success">Curiosity.</p>
      <p class="hint">GO INSIDE to return.</p>`;
  }

  if (state.flags.talkedToSenior) {
    state.mood += 10;
    return `<p class="thought">Maya's words echo: "The question isn't whether AI can code. It's whether YOU can do what AI can't."</p>
      <p class="thought">What can you do that AI can't?</p>
      <p class="thought">You can understand context. Care about users. Navigate politics. Mentor others. Debug intuition. Question requirements.</p>
      <p class="thought">Maybe the job is changing. Maybe that's okay.</p>`;
  }

  return `<p class="thought">Your mind races with thoughts about AI, your career, the future...</p>
    <p class="hint">Maybe talking to others would help. Try GOING to different locations and TALKing to people.</p>`;
}

function showInventory() {
  const items = [];
  if (state.flags.hadCoffee) items.push("warm coffee (comforting)");
  if (state.flags.triedCopilot) items.push("Copilot experience (conflicting)");
  if (state.flags.readArticle) items.push("existential dread (unwanted)");
  if (state.flags.talkedToSenior) items.push("Maya's wisdom (valuable)");
  if (state.flags.foundPerspective) items.push("new perspective (hard-won)");

  if (items.length === 0) {
    return `<p>You're not carrying anything noteworthy. Just your usual developer anxiety.</p>`;
  }

  return `<p class="items">You're carrying: ${items.join(', ')}</p>`;
}

function showHelp() {
  return `<p class="success">COMMANDS:</p>
    <p>LOOK - Describe your surroundings</p>
    <p>GO [direction] - Move (north, south, east, west, inside, outside)</p>
    <p>EXAMINE [thing] - Look at something closely</p>
    <p>TALK TO [person] - Have a conversation</p>
    <p>USE [item] - Interact with something</p>
    <p>THINK - Reflect on your situation</p>
    <p>INVENTORY - Check what you've gathered</p>
    <p>CODE - Try to write some code</p>
    <p class="hint">This is a story about a developer confronting the rise of AI. Explore, talk to people, and find your own answers.</p>`;
}

function checkEnding() {
  // Multiple possible endings based on choices
  if (state.flags.foundPerspective && state.flags.talkedToSenior && state.flags.talkedToJunior) {
    return `<div class="achievement">
      <p class="success">🏆 ENDING UNLOCKED: "The Mentor"</p>
      <p>You found perspective. You'll help guide the next generation through this transition, just as Maya guided you.</p>
      <p>The tools change. The craft endures.</p>
      <p class="hint">Thanks for playing. Refresh to explore other paths.</p>
    </div>`;
  }
  return null;
}

// Add text to output
function addOutput(html) {
  output.innerHTML += html;
  output.scrollTop = output.scrollHeight;
  
  const ending = checkEnding();
  if (ending) {
    output.innerHTML += ending;
  }
}

// Initialize game
function init() {
  addOutput(`<p class="success">THE DEVELOPER'S JOURNEY</p>
    <p class="hint">A text adventure about coding, AI, and finding your place.</p>
    <p class="hint">Type HELP for commands.</p>
    <hr style="border-color: #2d2d3d; margin: 1rem 0;">
    ${describeLook()}`);
}

// Handle input
input.addEventListener('keydown', e => {
  if (e.key === 'Enter' && input.value.trim()) {
    const cmd = input.value.trim();
    addOutput(`<p class="command">> ${cmd}</p>`);
    
    // Handle special multi-word commands
    if (cmd.toLowerCase() === 'code with ai') {
      state.flags.builtWithAI = true;
      addOutput(`<p>You type a comment describing what you need. Copilot fills in the rest.</p>
        <p>The code appears like magic. It works on the first try.</p>
        <p class="thought">You feel efficient. And somehow... empty. Where's the satisfaction of solving it yourself?</p>
        <p class="thought">But the ticket is done in 20 minutes instead of 2 hours. Isn't that good?</p>`);
    } else if (cmd.toLowerCase() === 'code traditional') {
      state.flags.builtTraditional = true;
      addOutput(`<p>You write the code yourself. Every function, every edge case, thought through and typed.</p>
        <p>It takes two hours. You have to look up the CSV library syntax. There's a bug with Unicode characters.</p>
        <p>But when the tests pass, you smile. You UNDERSTAND this code. Every line is yours.</p>
        <p class="thought">Is this pride? Or is it stubbornness masquerading as craftsmanship?</p>`);
    } else {
      addOutput(processCommand(cmd));
    }
    
    input.value = '';
  }
});

init();
