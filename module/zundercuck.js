// Import Modules
import { ZunItemSheet } from "./item-sheet.js";
import { ZunActorSheet } from "./actor-sheet.js";
import { measureDistance } from "./canvas.js";

/* -------------------------------------------- */
/*  Foundry VTT Initialization                  */
/* -------------------------------------------- */

Hooks.once("init", async function() {
  console.log(`ZUNDERCUCK!`);

  game.getAttributeValue = getAttributeValue;
  game.zundercuckRoll = zundercuckRoll;

	/**
	 * Set an initiative formula for the system
	 * @type {String}
	 */
	CONFIG.initiative.formula = "1d4";

  // Register sheet application classes
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("zundercuck", ZunActorSheet, { makeDefault: true });
  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("zundercuck", ZunItemSheet, {makeDefault: true});

  game.settings.register("zundercuck", "explodingDice", {
		name: "Exploding dice as default",
		hint: "Replaces all normal/easy dice rolls with exploding dice unless #noexplode or #ne are specified in the roll.",
		scope: "world",
		config: true,
		default: true,
		type: Boolean
	});
});

Hooks.on("canvasInit", function() {
  SquareGrid.prototype.measureDistance = measureDistance;
});

//effort command
Hooks.on("chatMessage", (chatlog, message) => {
  let [command, m] = parse(message);

  switch (command) {
    case "effort":
      const targets = Array.from(game.user.targets);
      const formula = message.replace(/\/e(?:ffort)?/, "").trim();
      
      const roll = zundercuckRoll(formula, {rollmode: "roll", display: true});
      let end = "";

      if (targets.length > 1) {
        end = " and " 
              + (targets.length - 1)
              + " other target" 
              + (targets.length > 2 ? "s" : "");
      } else if (targets.length < 1) {
        return false;
      }

      const total = canvas.tokens.get(ChatMessage.getSpeaker().token).actor.name 
                    + " deals "
                    + roll.total
                    + " effort to "
                    + targets[0].name
                    + end;
                        

      const chatData = mergeObject(
        {
          content: "<div class=\"dice-roll\">"
                  + "<h4 style=\"font-size: 16px; font-weight: bold\" class=\"dice-formula\">"
                  + total
                  + "</h4></div></div>"
        }, 
        {
          user: game.user._id,
          sound: CONFIG.sounds.dice,
          type: CONST.CHAT_MESSAGE_TYPES.OTHER
        }
      );
      
      targets.forEach(async (target) => {
         target.actor.update({"data.health.value": target.actor.data.data.health.value - Math.max(0, roll.total - target.actor.data.data.armor.value)});
      });

      ChatMessage.create(chatData);

      return false;
  }

  return true;
});

//initiative command
Hooks.on("chatMessage", (chatlog, message) => {
  let [command, m] = parse(message);

  switch (command) {
    case "initiative":
      const token = canvas.tokens.get(ChatMessage.getSpeaker().token);
      if (!token) { break; }

      let attr = message.replace(/\/i(?:nitiative)?/, "").trim();
      attr = getAttributeValue(token.actor, attr);
      
      game.combat.rollInitiative(game.combat.getCombatantByToken(token.id)._id, CONFIG.initiative.formula + "+" + attr);

      return false;
  }

  return true;
});

//dice roller attribute parser
Hooks.on("chatMessage", (chatlog, message) => {
  let [command, m] = parse(message);
  switch (command) {
    case "roll": case "gmroll": case "blindroll": case "selfroll":
      let formula = message.replace(/\/r(?:oll)?|\/gmr(?:oll)|\/b(?:lind)?r(?:oll)?|\/s(?:elf)?r(?:oll)?/, "").trim();
      
      zundercuckRoll(formula, {rollMode:command});
      return false;
  }

  return true;
});

function getAttributeValue(actor, attribute) {
  const attr = actor.data.data.attributes[attribute];
  return attr ? attr.value : 0;
}

function zundercuckRoll (formula, {rollMode="roll", chatData={}, display=true, explode=game.settings.get("zundercuck", "explodingDice")}={}) {
  const speaker = ChatMessage.getSpeaker();
  const actor = game.actors.get(speaker.actor);
  const token = canvas.tokens.get(speaker.token);
  const character = game.user.character;
  let isHard = false;

  if (formula.match(/#damp(\s|$)|#noexplode(\s|$)|#ne(\s|$)/i)) {
    explode = false;
  } else if (formula.match(/#explode(\s|$)|#ex(\s|$)/)) {
    explode = true;
  }

  formula = formula.replace(/#\S*/g, "").trim();

  let match = formula.match(/\d*d\d+h/g);
  if (match) {
    isHard = true;
    match.forEach((m) => {
      const groups = /(\d*)d(\d+)h/.exec(m);
      const left = groups[1]>1 ? (groups[1]-1 + "" + "d" + groups[2] + "+") : "";
      formula = formula.replace(groups[0], left + "abs(" + "1d" + groups[2] + "-" + "1d" + groups[2] + ")");
    });
  }

  match = formula.match(/\d*d\d+e/g);
  if (match) {
    match.forEach((m) => {
      const groups = /(\d*d(\d+))e/.exec(m);
      formula = formula.replace(groups[0], groups[1] + "+1d" + groups[2]);
    });
  }

  //actor attribute
  match = formula.match(/\@[^+\-\/*\s]*/g);
  if (match) {
    match.forEach((attr) => {
      const value = actor ? getAttributeValue(actor, attr.substring(1)) : 0;
      formula = formula.replace(attr, value);
    });
  }
  
  //token attribute
  match = formula.match(/\$[^+\-\/*\s]*/g);
  if (match) {
    match.forEach((attr) => {
      const value = token ? getAttributeValue(token.actor, attr.substring(1)) : 0;
      formula = formula.replace(attr, value);
    });
  }

  //character attribute
  match = formula.match(/\&[^+\-\/*\s]*/g);
  if (match) {
    match.forEach((attr) => {
      const value = character ? getAttributeValue(character, attr.substring(1)) : 0;
      formula = formula.replace(attr, value);
    });
  }
  
  if (explode && !isHard) {
    const regex = /(?!\d*d\d+[a-zA-Z])\d*d(\d+)/;
    
    match = formula.match(/(?!\d*d\d+[a-zA-Z])\d*d(\d+)/g);
    if (match) {
      match.forEach((part) => {
        const groups = regex.exec(part);5
        formula = formula.replace(regex, groups[0]+"x"+groups[1]);
      });
    }
  }

  const roll = new Roll(formula, {});
  roll.roll();
  if (display) {
    roll.toMessage({chatData}, {rollMode:rollMode, create:true});
  }

  if (!actor && formula.includes('@')) {
    ui.notifications.warn('A token attribute was specified in your roll, but no token was selected.');
  }
  return roll;
}

function parse(message) {
  // Dice roll regex
  let formula = '([^#]*)';                  // Capture any string not starting with '#'
  formula += '(?:(?:#\\s?)(.*))?';          // Capture any remaining flavor text
  const roll = '^(\\/r(?:oll)? )';          // Regular rolls, support /r or /roll
  const gm = '^(\\/gmr(?:oll)? )';          // GM rolls, support /gmr or /gmroll
  const br = '^(\\/b(?:lind)?r(?:oll)? )';  // Blind rolls, support /br or /blindroll
  const sr = '^(\\/s(?:elf)?r(?:oll)? )';   // Self rolls, support /sr or /sroll
  const initiative = '^(\\/i(?:nitiative)? )';
  const effort = '^(\\/e(?:ffort)? )';
  const any = '([^]*)';                     // Any character, including new lines
  const word = '\\S+';

  // Define regex patterns
  const patterns = {
    "roll": new RegExp(roll+formula, 'i'),
    "gmroll": new RegExp(gm+formula, 'i'),
    "blindroll": new RegExp(br+formula, 'i'),
    "selfroll": new RegExp(sr+formula, 'i'),
    "effort": new RegExp(effort+formula, 'i'),
    "initiative": new RegExp(initiative+word+'$', 'i'),
    "ic": new RegExp('^(\/ic )'+any, 'i'),
    "ooc": new RegExp('^(\/ooc )'+any, 'i'),
    "emote": new RegExp('^(\/em(?:ote)? )'+any, 'i'),
    "whisper": new RegExp(/^(@|\/w(?:hisper)?\s{1})(\[(?:[^\]]+)\]|(?:[^\s]+))\s+([^]*)/, 'i'),
    "none": new RegExp('()'+any, 'i')
  };

  // Iterate over patterns, finding the first match
  let c, rgx, match;
  for ( [c, rgx] of Object.entries(patterns) ) {
    match = message.match(rgx); 
    if ( match ) return [c, match];
  }
  return [null, null];
}

export const _onCombatantControl = function (event) {
  console.log("Bip!");
}