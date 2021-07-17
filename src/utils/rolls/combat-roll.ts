import { DiceRoll } from "rpg-dice-roller";
import { RollResult, RollResults } from "rpg-dice-roller/types/results";
import { DamageType, damageTypeText } from "../damage";

import {
  DamageEffect,
  DamageEffectResult,
  DamageEffectType,
} from "../damage-effect";
import {
  getHitLocation,
  getHitLocationText,
  HitLocationType,
} from "../hit-locations";
import { pluralize } from "../pluralize";
import { roller } from "./roller";

export interface CombatRollOptions {
  dice: number;
  damageType: DamageType;
  damageEffects?: DamageEffect[];
  hitLocation?: string;
  hitLocationType?: HitLocationType;
}

export interface CombatRollData {
  index: number;
  damage: number;
  effect: number;
  output: string;
}

export interface CombatRollEffect {
  index: number;
  damage: number;
  effect: DamageEffectResult;
  output: string;
}

export interface CombatRollResult {
  damage: number;
  effects: DamageEffectResult[];
  results: CombatRollData[];
  rolls: RollResult[];
  hitLocation: string;
  hitLocationType: HitLocationType;
}

const getOutput = (value: number, effect: number): string => {
  let output = `${value}`;

  if (value > 0) {
    output = effect ? `_**${value}**_` : `_${value}_`;
  }

  return output;
};

const getDamage = (value: number) => {
  switch (value) {
    case 1:
    case 5:
    case 6:
      return 1;
    case 2:
      return 2;
    case 3:
    case 4:
    default:
      return 0;
  }
};

const getCombatValue = (value: number): { damage: number; effect: number } => ({
  damage: getDamage(value),
  effect: [5, 6].includes(value) ? 1 : 0,
});

const getRollResults = (
  rolls: RollResult[]
): { damage: number; effects: number; results: CombatRollData[] } => {
  const results = rolls.reduce((accumulator, { value }: RollResult, index) => {
    const { damage, effect } = getCombatValue(value);
    const output = getOutput(value, effect);

    accumulator.push({
      index,
      damage,
      effect,
      output,
    });

    return accumulator;
  }, [] as CombatRollData[]);

  return {
    damage: results.reduce((current, result) => current + result.damage, 0),
    effects: results.reduce((current, result) => current + result.effect, 0),
    results,
  };
};

export const hitLocationRoll = (
  type: HitLocationType = HitLocationType.Default
): string => {
  const diceCommand = `1d20`;
  const { rolls } = roller.roll(diceCommand) as DiceRoll;
  const rollResult = (rolls as RollResults[])[0].rolls[0].value;
  const location = getHitLocation(type, rollResult);

  return location;
};

const getEffects = (
  value: number,
  types: DamageEffect[],
  damage: number,
  damageType: DamageType,
  hitLocationType: HitLocationType
): DamageEffectResult[] => {
  if (!value) {
    return [];
  }

  return types.reduce<DamageEffectResult[]>((effects, { type, rating }) => {
    switch (type) {
      case DamageEffectType.Breaking:
        effects.push({
          type,
          text: `Reduce the number of Combat Dice a target’s cover provides by ${value} permanently. If the target is not in cover, instead reduce the ${damageTypeText[damageType]} DR of the location struck by ${value}.`,
        });
        break;
      case DamageEffectType.Burst:
        effects.push({
          type,
          text: `The attack hits ${value} additional ${pluralize(
            "target",
            value
          )} within Close range of the primary target, consuming ${value} additional ${pluralize(
            "unit",
            value
          )} of ammunition from the weapon.`,
        });
        break;
      case DamageEffectType.Persistent:
        effects.push({
          type,
          text: `The target suffers the weapon’s damage again at the end of their next and ${value} turns, for a number. The target can spend a major action to make a test to stop persistent damage early, with a difficulty of ${value}, and the attribute + skill chosen by the GM. Some Persistent weapons may inflict a different type of damage to the weapon, and where this is the case, it will be noted in brackets, for example: Persistent (Poison).`,
        });
        break;
      case DamageEffectType.PiercingX:
        effects.push({
          type,
          text: `Ignore ${value * (rating || 1)} points of the target’s ${
            damageTypeText[damageType]
          } DR.`,
        });
        break;
      case DamageEffectType.Radioactive:
        effects.push({
          type,
          text: `The target also suffers ${value} ${pluralize(
            "point",
            value
          )} of radiation damage. This radiation damage is totalled and applied separately, after a character has suffered the normal damage from the attack.`,
        });
        break;
      case DamageEffectType.Spread: {
        const hitLocation = hitLocationRoll(hitLocationType);
        effects.push({
          type,
          text: `Your attack inflicts ${Math.floor(
            damage / 2
          )} additional damage to the target's ${getHitLocationText(
            hitLocationType,
            hitLocation
          )}.`,
        });
        break;
      }
      case DamageEffectType.Stun:
        effects.push({
          type,
          text: `The target cannot take their normal actions on their next turn. A stunned character or creature can still spend AP to take additional actions as normal.`,
        });
        break;
      case DamageEffectType.Vicious:
        effects.push({
          type,
          text: ` The attack inflicts an additional ${value} damage.`,
        });
        break;
    }

    return effects;
  }, []);
};

const handleRollResults = (
  damage: number,
  damageType: DamageType,
  effectOccurences: number,
  effectTypes: DamageEffect[],
  hitLocation: string,
  hitLocationType: HitLocationType,
  results: CombatRollData[],
  rolls: RollResult[]
) => {
  const effects = getEffects(
    effectOccurences,
    effectTypes,
    damage,
    damageType,
    hitLocationType
  );

  const result = {
    damage,
    effects,
    hitLocation,
    hitLocationType,
    results,
    rolls,
  };

  return result;
};

export const combatRoll = ({
  dice,
  damageType,
  damageEffects = [],
  hitLocation,
  hitLocationType = HitLocationType.Default,
}: CombatRollOptions): CombatRollResult => {
  const diceCommand = `${dice}d6`;
  const { rolls } = roller.roll(diceCommand) as DiceRoll;
  const rollResults = (rolls as RollResults[])[0].rolls;
  const { damage, effects, results } = getRollResults(rollResults);

  const hitLocationResult = hitLocation || hitLocationRoll(hitLocationType);

  const roll = handleRollResults(
    damage,
    damageType,
    effects,
    damageEffects,
    hitLocationResult,
    hitLocationType,
    results,
    rollResults
  );

  return roll;
};

export const combatReroll = (
  dice: number,
  {
    damageType,
    damageEffects = [],
    hitLocation,
    hitLocationType = HitLocationType.Default,
  }: Omit<CombatRollOptions, "dice">,
  { rolls: previousRolls }: CombatRollResult
): CombatRollResult => {
  const diceCommand = `${dice}d6`;

  const { rolls } = roller.roll(diceCommand) as DiceRoll;
  const rollResults = (rolls as RollResults[])[0].rolls;

  const newRolls = previousRolls
    .sort((a, b) => a.value - b.value)
    .slice(0, previousRolls.length - dice)
    .concat(rollResults)
    .sort((a, b) => a.value - b.value);

  const { damage, effects, results } = getRollResults(newRolls);
  const roll = handleRollResults(
    damage,
    damageType,
    effects,
    damageEffects,
    hitLocation || hitLocationRoll(hitLocationType),
    hitLocationType,
    results,
    rollResults
  );

  return roll;
};