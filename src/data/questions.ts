import type { Question } from '../game/types';

/**
 * The question bank. Each game draws a random subset of these.
 * Keep the mix of true and fake claims roughly balanced.
 */
export const QUESTIONS: Question[] = [
  {
    id: 'wombat-cubes',
    claim: 'Wombats produce cube-shaped poop.',
    isTrue: true,
    explanation:
      'Their intestines have stretchy and stiff sections that shape it into cubes. The flat sides stop it rolling off the rocks they use to mark territory.',
  },
  {
    id: 'oxford-aztecs',
    claim: 'Oxford University is older than the Aztec Empire.',
    isTrue: true,
    explanation:
      'Teaching at Oxford began around 1096. Tenochtitlan, the Aztec capital, was founded in 1325.',
  },
  {
    id: 'octopus-hearts',
    claim: 'An octopus has three hearts.',
    isTrue: true,
    explanation:
      'Two hearts pump blood through the gills, and a third pumps it around the rest of the body. Their blood is blue, too.',
  },
  {
    id: 'banana-berry',
    claim: 'Botanically, a banana is a berry but a strawberry is not.',
    isTrue: true,
    explanation:
      'A berry develops from a single flower with one ovary. Bananas qualify. Strawberries are "accessory fruits", and their seeds sit on the outside.',
  },
  {
    id: 'scotland-unicorn',
    claim: 'The national animal of Scotland is the unicorn.',
    isTrue: true,
    explanation:
      'The unicorn has been a Scottish heraldic symbol since the 12th century and appears on the royal coat of arms.',
  },
  {
    id: 'venus-day',
    claim: 'A day on Venus lasts longer than a year on Venus.',
    isTrue: true,
    explanation:
      'Venus takes about 243 Earth days to spin once on its axis, but only about 225 Earth days to orbit the Sun.',
  },
  {
    id: 'sharks-trees',
    claim: 'Sharks existed before trees did.',
    isTrue: true,
    explanation:
      'The earliest sharks appeared around 450 million years ago. The first trees showed up roughly 385 million years ago.',
  },
  {
    id: 'cleopatra-moon',
    claim: 'Cleopatra lived closer in time to the Moon landing than to the building of the Great Pyramid.',
    isTrue: true,
    explanation:
      'The Great Pyramid was finished around 2560 BC. Cleopatra was born in 69 BC, about 2,000 years after the pyramid and 2,040 years before Apollo 11.',
  },
  {
    id: 'nintendo-cards',
    claim: 'Nintendo was founded in 1889 as a playing-card company.',
    isTrue: true,
    explanation:
      'Fusajiro Yamauchi started Nintendo in Kyoto making hanafuda cards. Video games came almost a century later.',
  },
  {
    id: 'goldfish-memory',
    claim: 'Goldfish have a memory span of about three seconds.',
    isTrue: false,
    explanation:
      'Experiments show goldfish can remember things for months, and they can be trained to respond to sounds, colours and feeding times.',
  },
  {
    id: 'great-wall-moon',
    claim: 'The Great Wall of China is visible from the Moon with the naked eye.',
    isTrue: false,
    explanation:
      'The wall is long but narrow, and no astronaut has seen it from the Moon. It is hard to spot even from low Earth orbit.',
  },
  {
    id: 'lightning-twice',
    claim: 'Lightning never strikes the same place twice.',
    isTrue: false,
    explanation:
      'Tall structures get hit again and again. The Empire State Building is struck around 20 times a year.',
  },
  {
    id: 'brain-ten-percent',
    claim: 'Humans only use about 10% of their brains.',
    isTrue: false,
    explanation:
      'Brain scans show activity across almost every region, even during sleep. There is no dormant 90%.',
  },
  {
    id: 'bulls-red',
    claim: 'Bulls charge at matadors because the colour red makes them angry.',
    isTrue: false,
    explanation:
      'Bulls are red–green colourblind. It is the movement of the cape that provokes them, not its colour.',
  },
  {
    id: 'napoleon-short',
    claim: 'Napoleon Bonaparte was unusually short for his time.',
    isTrue: false,
    explanation:
      'He was about 1.69 m (5 ft 7 in), average or a little above for a Frenchman of his era. Confusion between French and English inches helped start the myth.',
  },
  {
    id: 'penny-drop',
    claim: 'A penny dropped from the top of the Empire State Building could kill someone below.',
    isTrue: false,
    explanation:
      'A flat, light coin tumbles and reaches a terminal velocity of only about 40–80 km/h. It would sting, but not much more.',
  },
  {
    id: 'chameleon-camouflage',
    claim: 'Chameleons change colour mainly to blend in with their surroundings.',
    isTrue: false,
    explanation:
      'They mostly change colour to signal mood and to control their body temperature. Camouflage is largely a side effect.',
  },
];
