// Import Modules
import { ZunItemSheet } from "./item-sheet.js";
import { ZunActorSheet } from "./actor-sheet.js";

/* -------------------------------------------- */
/*  Foundry VTT Initialization                  */
/* -------------------------------------------- */

Hooks.once("init", async function() {
  console.log(`ZUNDERCUCK!`);

  game.getattribute = getattribute;

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
});

Hooks.on("chatMessage", (chatlog, message, chatData) => {
  const speaker = ChatMessage.getSpeaker();
  const actor = game.actors.get(speaker.actor);
  const token = canvas.tokens.get(speaker.token);
  const character = game.user.character;

  let [command, m] = chatlog.constructor.parse(message);
  switch (command) {
    case "roll": case "gmroll": case "blindroll": case "selfroll":
      var formula = message.replace(/\/roll|\/gmroll|\/blindroll|\/selfroll/, "").trim();
      
      //actor attribute
      var match = formula.match(/\@[^+\-\/*\s]*/g);
      if (match) {
        match.forEach((attr) => {
          console.log (attr.substring(1));
          const value = actor ? getattribute(actor, attr.substring(1)) : 0;
          console.log(value);
          formula = formula.replace(attr, value);
        });
      }
      
      //token attribute
      match = formula.match(/\$[^+\-\/*\s]*/g);
      if (match) {
        match.forEach((attr) => {
          console.log (attr.substring(1));
          const value = token ? getattribute(token.actor, attr.substring(1)) : 0;
          console.log(value);
          formula = formula.replace(attr, value);
        });
      }

      //character attribute
      match = formula.match(/\&[^+\-\/*\s]*/g);
      if (match) {
        match.forEach((attr) => {
          console.log (attr.substring(1));
          const value = character ? getattribute(character, attr.substring(1)) : 0;
          console.log(value);
          formula = formula.replace(attr, value);
        });
      }

      console.log(formula);
      const roll = new Roll(formula, {});
      console.log(roll);
      roll.roll();
      roll.toMessage({rollMode: command});
      
      return false;
  }

  return true;
});

function getattribute(actor, attribute) {
  const attr = actor.data.data.attributes[attribute];
  return attr ? attr.value : 0;
}
