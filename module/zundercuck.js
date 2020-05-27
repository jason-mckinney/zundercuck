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
  game.zundercuckEffort = zundercuckEffort;

	/**
	 * Set an initiative formula for the system
	 * @type {String}
	 */
	CONFIG.Combat.initiative.formula = "1d4";

  // Register sheet application classes
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("zundercuck", ZunActorSheet, { makeDefault: true });
  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("zundercuck", ZunItemSheet, {makeDefault: true});

  /*game.settings.register("zundercuck", "explodingDice", {
		name: "Exploding dice as default",
		hint: "Replaces all normal/easy dice rolls with exploding dice unless #noexplode or #ne are specified in the roll.",
		scope: "world",
		config: true,
		default: false,
		type: Boolean
  });*/
  
  Handlebars.registerHelper("coinOrSupplies", function(data) {
    if (data.coin) {
      return true;
    } else if (data.supplies){
      return true;
    }

    return false;
  });

  Handlebars.registerHelper("supplyCount", function(items) {
    let count = 0;
    items.forEach((item) => { if(item.name.toLowerCase() === "supply") { count++; } });

    return count;
  });
});

Hooks.on("canvasInit", function() {
  SquareGrid.prototype.measureDistance = measureDistance;
});

//effort command
Hooks.on("chatMessage", (chatlog, message) => {
  let [command, m] = parse(message);

  switch (command) {
    case "effort": case "attack":
      const targets = Array.from(game.user.targets);
      const formula = message.replace(/\/e(?:ffort)?/, "").replace(/\/a(?:ttack)?/, "").trim();

      zundercuckEffort(formula, targets);

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

      let initiative = token.actor.data.data.saves.reflex.value;
      
      game.combat.rollInitiative(game.combat.getCombatantByToken(token.id)._id, CONFIG.Combat.initiative.formula + "+" + initiative);

      return false;
  }

  return true;
});

//dice roller attribute parser
Hooks.on("chatMessage", (chatlog, message) => {
  let [command, m] = parse(message);
  switch (command) {
    case "roll": case "gmroll": case "blindroll": case "selfroll":
      let formula = message.replace(/\/r(?:oll)?|\/gmr(?:oll)?|\/b(?:lind)?r(?:oll)?|\/s(?:elf)?r(?:oll)?/, "").trim();
      
      zundercuckRoll(formula, {rollMode:command});
      return false;
  }

  return true;
});

function getAttributeValue(actor, attribute) {
  const attr = actor.data.data.attributes[attribute];
  return attr ? attr.value : 0;
}

function zundercuckEffort (formula, targets, targetActor=null) {
  const rollMode = game.settings.get("core", "rollMode");
  const roll = zundercuckRoll(formula, {rollMode: rollMode, targetActor: targetActor, display: true});
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
                    
  let chatData = mergeObject(
    {
      content: "<div class=\"dice-roll\">"
              + "<h4 style=\"font-size: 16px; font-weight: bold\" class=\"dice-formula\">"
              + total
              + "</h4></div></div>"
    }, 
    {
      user: game.user._id,
      sound: CONFIG.sounds.dice,
      type: CONST.CHAT_MESSAGE_TYPES.OTHER,
      blind: rollMode === "blindroll"
    }
  );
  
  switch(rollMode) {
    case "gmroll": case "blindroll":
      chatData.whisper = game.users.entities.filter(u => u.isGM).map(u => u._id);
      break;
    case "selfroll":
      chatData.whisper = [game.user._id];
      break;
  }

  targets.forEach(async (target) => {
    let totalDamage = roll.total - target.actor.data.data.armor.value;
    let tempDamage = Math.min(target.actor.data.data.health.temp, totalDamage);
    let hpDamage = totalDamage - tempDamage;
    
    await target.actor.update({"data.health.temp": target.actor.data.data.health.temp - Math.max(0, tempDamage)});
    target.actor.update({"data.health.value": target.actor.data.data.health.value - Math.max(0, hpDamage)});
  });

  ChatMessage.create(chatData);
}

function zundercuckRoll (formula, {targetActor=null, rollMode=game.settings.get("core", "rollMode"), chatData={}, display=true, explode=false}={}) {
  const speaker = ChatMessage.getSpeaker();
  const actor = targetActor ? targetActor : game.actors.get(speaker.actor);
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
      let nDice = groups[1];

      if (nDice == "") {
        nDice = 1;
      } else if ((nDice=Number(nDice)) <= 1) {
        nDice = 1;
      }
      
      formula = formula.replace(/(\d*)d(\d+)h/, String(nDice+1) + "d" + groups[2] + "kh" + String(nDice));
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
        const groups = regex.exec(part);
        formula = formula.replace(regex, groups[0]+"x"+groups[1]);
      });
    }
  }

  const roll = new Roll(formula, {});
  roll.roll();

  if (isHard) {
    for (let itr = 0; itr < roll.parts.length; ++itr) {
      let it = roll.parts[itr]
      if (it instanceof Die && it.formula.includes("kh")) {
        for (let jtr = 0; jtr < it.rolls.length; ++jtr) {
          if (it.rolls[jtr].discarded) {
            roll._total -= it.rolls[jtr].roll;

            it.rolls[jtr].discarded = false;
            it.rolls[jtr].roll *= -1;
          }
        }

        it.formula = it.formula.replace(/kh\d*/g, "h");
        
        match = it.formula.match(/(\d*)(d(\d+)h)/);
        if (match) {
          it.formula = String(Number(match[1]) - 1) + match[2];
        }
      }
    }

    roll._formula = roll._formula.replace(/kh\d*/g, "h");

    match = roll._formula.match(/(\d*)d(\d+)h/g);
    if (match) {
      match.forEach ((part) => {
        const groups = /(\d*)(d(\d+)h)/.exec(part);
        roll._formula = roll._formula.replace(groups[0], String(Number(groups[1]) - 1) + groups[2]);
      })
    }

    roll.formula = roll._formula
    roll._result = String(roll._total);
  }

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
  const initiative = '^(\\/i(?:nitiative)?\S*)';
  const effort = '^(\\/e(?:ffort)? )';
  const attack = '^(\\/a(?:ttack)? )';
  const any = '([^]*)';                     // Any character, including new lines
  const word = '\\S+';

  // Define regex patterns
  const patterns = {
    "roll": new RegExp(roll+formula, 'i'),
    "gmroll": new RegExp(gm+formula, 'i'),
    "blindroll": new RegExp(br+formula, 'i'),
    "selfroll": new RegExp(sr+formula, 'i'),
    "effort": new RegExp(effort+formula, 'i'),
    "attack": new RegExp(attack+formula, 'i'),
    "initiative": new RegExp(initiative+formula, 'i'),
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
