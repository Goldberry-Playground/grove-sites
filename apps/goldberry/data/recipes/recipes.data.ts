/**
 * GOL-3435: 158 recipes transcribed from five West Virginia community cookbooks.
 *
 * GENERATED from the approved design (`goldberry-recipes-design.html`, the
 * `RECIPES` constant, attached to GOL-3435 on 2026-10-19). Do not hand-edit the
 * credits: every `contributor`, `contributorRole`, `city` and `state` is kept
 * exactly as the book printed it, `null` where the book printed nothing, and
 * the `editorNotes` that mark unreadable or guessed text stay with the recipe.
 */
import type { Recipe } from "./types";

export const RECIPES: readonly Recipe[] = [
 {
  "id": "coca-cola-salad",
  "title": "Coca-Cola Salad",
  "category": "Salads",
  "book": "central",
  "contributor": "Mrs. C. Edwin Watkins",
  "contributorRole": null,
  "city": "Beckley",
  "state": "West Virginia",
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "2 pkg.",
      "item": "cherry gelatin (Jell-O)"
     },
     {
      "qty": "1 can",
      "item": "crushed pineapple"
     },
     {
      "qty": "1 can",
      "item": "Bing cherries"
     },
     {
      "qty": "1 cup",
      "item": "hot liquid"
     },
     {
      "qty": "1 cup",
      "item": "nuts"
     },
     {
      "qty": "2 small or 1 large",
      "item": "Coca-Cola"
     },
     {
      "qty": "1 pkg.",
      "item": "cream cheese"
     }
    ]
   }
  ],
  "steps": [
   "Dissolve the gelatin and cream cheese in the hot liquid.",
   "Add the rest of the ingredients."
  ],
  "tips": [],
  "ovenTemp": null,
  "cookTime": null,
  "yield": null,
  "editorNotes": [
   "Can sizes for pineapple and cherries are not given.",
   "'Hot liquid' is not specified; likely juice drained from the canned fruit, as in the similar recipes that follow.",
   "Bottle size for 'small' and 'large' Coke not given; 1960s small bottles were 6½ oz.",
   "Method gives no chilling step; presumably chill in a mold until firm."
  ]
 },
 {
  "id": "cherry-deluxe",
  "title": "Cherry Deluxe",
  "category": "Salads",
  "book": "central",
  "contributor": "Mrs. J. C. Blanka",
  "contributorRole": null,
  "city": "Richmond",
  "state": "Virginia",
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "2 pkg.",
      "item": "cherry gelatin"
     },
     {
      "qty": "2 small",
      "item": "Coca-Cola"
     },
     {
      "qty": "1 (8 oz.) pkg.",
      "item": "cream cheese"
     },
     {
      "qty": "1 (No. 2) can",
      "item": "crushed pineapple"
     },
     {
      "qty": "1 (No. 2½) can",
      "item": "black cherries"
     },
     {
      "qty": "1 cup",
      "item": "pecans or walnuts"
     },
     {
      "qty": "2 cups",
      "item": "juice, drained from the fruit"
     }
    ]
   },
   {
    "name": "Also needed",
    "items": [
     {
      "qty": "",
      "item": "oil, for greasing the molds"
     }
    ]
   }
  ],
  "steps": [
   "Heat the fruit juices and pour over the gelatin, stirring well until all is dissolved.",
   "Let cool, then add the Coke.",
   "Chill in the refrigerator until syrupy.",
   "Add the fruits and nuts and stir well.",
   "Cut the cream cheese into small cubes and add to the mixture.",
   "Grease 1 large or 2 small ring molds with oil.",
   "Pour the salad in and return to the refrigerator until firm."
  ],
  "tips": [],
  "ovenTemp": null,
  "cookTime": null,
  "yield": null,
  "editorNotes": [
   "In the source, the first four ingredients are printed above the title; they are restored to this recipe.",
   "Source reads '#2z Can blach cherries'; shown as a No. 2½ can of black cherries.",
   "Bottle size for 'small' Coca-Cola not given; 1960s small bottles were 6½ oz."
  ]
 },
 {
  "id": "delicious-frozen-fruit-salad",
  "title": "Delicious Frozen Fruit Salad",
  "category": "Salads",
  "book": "central",
  "contributor": "Mrs. Charles Winkler",
  "contributorRole": "President",
  "city": "Council",
  "state": "Idaho",
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "1 pkg.",
      "item": "cream cheese"
     },
     {
      "qty": "¼ cup",
      "item": "maraschino cherries"
     },
     {
      "qty": "1 cup",
      "item": "crushed pineapple"
     },
     {
      "qty": "½ cup",
      "item": "green peppers, chopped"
     },
     {
      "qty": "½ cup",
      "item": "cooked salad dressing"
     },
     {
      "qty": "½ cup",
      "item": "pecans"
     },
     {
      "qty": "1 cup",
      "item": "cream, whipped"
     }
    ]
   },
   {
    "name": "Also needed",
    "items": [
     {
      "qty": "",
      "item": "crisp salad greens, for serving"
     }
    ]
   }
  ],
  "steps": [
   "Mash the cream cheese and blend with the dressing.",
   "Add the pineapple, cherries, chopped green peppers and nuts.",
   "Fold into the whipped cream and turn into a freezing tray.",
   "Freeze about 2 hours."
  ],
  "tips": [
   "When frozen, serve on crisp greens."
  ],
  "ovenTemp": null,
  "cookTime": "Freeze about 2 hours",
  "yield": null,
  "editorNotes": [
   "Source reads '¿ Cup maraschino cherries'; shown as ¼ cup (garbled fraction, best guess).",
   "Source reads '2 Cup green peppers'; shown as ½ cup (likely a dropped fraction).",
   "Source reads '≥ Cup' for both salad dressing and pecans; shown as ½ cup (garbled fraction, best guess).",
   "Cream cheese package size not given; likely 3 oz. or 8 oz."
  ]
 },
 {
  "id": "wild-rice-casserole",
  "title": "Wild Rice Casserole",
  "category": "Main Dishes",
  "book": "central",
  "contributor": "Mrs. Grant Sawyer",
  "contributorRole": "Governor's Mansion",
  "city": "Carson City",
  "state": "Nevada",
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "1 lb.",
      "item": "sausage meat"
     },
     {
      "qty": "2 small cans",
      "item": "mushrooms"
     },
     {
      "qty": "2 medium",
      "item": "onions, chopped"
     },
     {
      "qty": "2 cups",
      "item": "wild rice, washed"
     },
     {
      "qty": "1 Tbsp.",
      "item": "salt (for the rice water)"
     },
     {
      "qty": "¼ cup",
      "item": "flour"
     },
     {
      "qty": "½ cup",
      "item": "heavy cream"
     },
     {
      "qty": "2½ cups",
      "item": "chicken broth"
     },
     {
      "qty": "⅛ tsp.",
      "item": "pepper"
     },
     {
      "qty": "1 tsp.",
      "item": "Accent (MSG seasoning)"
     },
     {
      "qty": "",
      "item": "pinch each of oregano, thyme and marjoram"
     },
     {
      "qty": "½ cup",
      "item": "blanched almonds, toasted"
     }
    ]
   }
  ],
  "steps": [
   "Sauté the sausage meat, drain and break into small pieces.",
   "Sauté the chopped onions in the fat left in the pan.",
   "Add the mushrooms and cooked sausage.",
   "Cook the rice in boiling salted water, boiling briskly for 20 minutes.",
   "Simmer uncovered to steam-dry the rice, then drain.",
   "Mix the flour with the cream until smooth.",
   "Add the broth and cook until thickened; add the seasonings.",
   "Combine with the other ingredients and toss until well blended.",
   "Pour into a casserole and bake 25–30 minutes in a moderate oven, 350°F.",
   "Sprinkle toasted almonds on top when ready to serve."
  ],
  "tips": [],
  "ovenTemp": "350°F",
  "cookTime": "25–30 minutes",
  "yield": null,
  "editorNotes": [
   "Source reads '• Cup flour'; shown as ¼ cup (garbled fraction, best guess).",
   "Source reads '2 Cup heavy cream'; shown as ½ cup (likely a dropped fraction).",
   "Source reads '2z Cups chicken broth'; shown as 2½ cups.",
   "Source reads 'z Cup blanched almonds'; shown as ½ cup.",
   "Mushroom can size not given."
  ]
 },
 {
  "id": "cottage-cheese-jello-salad",
  "title": "Cottage Cheese Jello Salad",
  "category": "Salads",
  "book": "central",
  "contributor": "Mrs. Leonard W. Thomas",
  "contributorRole": "President, State Federation",
  "city": null,
  "state": "Washington",
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "1 pkg.",
      "item": "lime gelatin"
     },
     {
      "qty": "1 pkg.",
      "item": "lemon gelatin"
     },
     {
      "qty": "1½ cups",
      "item": "hot water"
     },
     {
      "qty": "1 cup",
      "item": "crushed pineapple"
     },
     {
      "qty": "¼ cup",
      "item": "pineapple juice"
     },
     {
      "qty": "1 cup",
      "item": "cottage cheese"
     },
     {
      "qty": "2 Tbsp.",
      "item": "mayonnaise"
     },
     {
      "qty": "¼ cup",
      "item": "black walnuts"
     }
    ]
   },
   {
    "name": "Also needed",
    "items": [
     {
      "qty": "",
      "item": "lettuce, for serving"
     }
    ]
   }
  ],
  "steps": [
   "Combine the gelatin, hot water and pineapple juice; mix thoroughly and set aside to cool.",
   "In a separate bowl, mix the crushed pineapple, mayonnaise, cottage cheese and walnuts.",
   "Add to the gelatin.",
   "Place in the refrigerator to set."
  ],
  "tips": [
   "Serve on a bed of lettuce."
  ],
  "ovenTemp": null,
  "cookTime": null,
  "yield": null,
  "editorNotes": [
   "Source reads '12 Cups hot water'; shown as 1½ cups.",
   "Source reads '¿ Cup pineapple juice' and '¿ Cup black walnuts'; both shown as ¼ cup (garbled fraction, best guess).",
   "No city is printed; 'Washington' is given only as the state of her federation."
  ]
 },
 {
  "id": "bing-cherry-salad",
  "title": "Bing Cherry Salad",
  "category": "Salads",
  "book": "central",
  "contributor": "Mrs. B. Ray Blevins",
  "contributorRole": null,
  "city": "Logan",
  "state": "West Virginia",
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "1 (8 oz.) pkg.",
      "item": "cream cheese"
     },
     {
      "qty": "1 large can",
      "item": "Bing cherries"
     },
     {
      "qty": "2",
      "item": "Coca-Colas"
     },
     {
      "qty": "1 pkg.",
      "item": "cherry gelatin"
     },
     {
      "qty": "1 pkg.",
      "item": "raspberry gelatin"
     },
     {
      "qty": "1 can",
      "item": "crushed pineapple"
     },
     {
      "qty": "1 cup",
      "item": "nuts"
     }
    ]
   }
  ],
  "steps": [
   "Bring the juices from the pineapple and cherries to a boil.",
   "Dissolve the gelatin in the boiled juices and chill.",
   "When thoroughly chilled, add the Cokes, pineapple, cherries, cream cheese and nut meats, breaking the cream cheese into large pieces as you add it.",
   "Return to the refrigerator until the mold is firm."
  ],
  "tips": [],
  "ovenTemp": null,
  "cookTime": null,
  "yield": null,
  "editorNotes": [
   "Source reads '• Large can bing cherries'; shown as 1 large can.",
   "Quantity for cherry gelatin is missing in the source; shown as 1 pkg.",
   "Coca-Cola bottle size not given; pineapple can size not given."
  ]
 },
 {
  "id": "bing-cherry-salad-rouse",
  "title": "Bing Cherry Salad (Rouse)",
  "category": "Salads",
  "book": "central",
  "contributor": "Mrs. Franklin A. Rouse",
  "contributorRole": null,
  "city": "Huntington",
  "state": "West Virginia",
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "1 (No. 2) can",
      "item": "crushed pineapple"
     },
     {
      "qty": "½ cup",
      "item": "pecan meats"
     },
     {
      "qty": "1 pkg.",
      "item": "cherry gelatin"
     },
     {
      "qty": "1 cup",
      "item": "hot juice"
     },
     {
      "qty": "1 cup",
      "item": "Bing cherries"
     }
    ]
   }
  ],
  "steps": [
   "Combine all ingredients.",
   "Refrigerate until ready to serve."
  ],
  "tips": [],
  "ovenTemp": null,
  "cookTime": null,
  "yield": null,
  "editorNotes": [
   "Source reads '2 Cup pecan meats'; shown as ½ cup (likely a dropped fraction).",
   "Source reads 'l Cups hot juice'; shown as 1 cup.",
   "Method is very brief; dissolve the gelatin in the hot juice before combining."
  ]
 },
 {
  "id": "sweet-potato-balls",
  "title": "Sweet Potato Balls",
  "category": "Vegetables & Sides",
  "book": "central",
  "contributor": "Mrs. Paul Bottome",
  "contributorRole": null,
  "city": "Logan",
  "state": "West Virginia",
  "ingredientGroups": [
   {
    "name": "Potato balls",
    "items": [
     {
      "qty": "2½ cups",
      "item": "sweet potatoes, cooked (and mashed)"
     },
     {
      "qty": "⅔ cup",
      "item": "sugar"
     },
     {
      "qty": "½ cup",
      "item": "black walnuts"
     },
     {
      "qty": "⅛ tsp.",
      "item": "nutmeg"
     },
     {
      "qty": "1 stick",
      "item": "margarine (oleo)"
     }
    ]
   },
   {
    "name": "Also needed",
    "items": [
     {
      "qty": "",
      "item": "pineapple slices"
     },
     {
      "qty": "½ cup",
      "item": "pineapple juice"
     },
     {
      "qty": "½ cup",
      "item": "brown sugar"
     },
     {
      "qty": "",
      "item": "crushed corn flakes"
     },
     {
      "qty": "½ cup",
      "item": "butter, melted"
     },
     {
      "qty": "",
      "item": "paprika"
     },
     {
      "qty": "",
      "item": "butter, for the dish"
     }
    ]
   }
  ],
  "steps": [
   "Cook the sweet potatoes and mix with the sugar, black walnuts, nutmeg and margarine.",
   "Butter an oblong baking dish.",
   "Cover the bottom with pineapple slices and ½ cup juice; sprinkle over ½ cup brown sugar.",
   "Divide the potato mixture and make small balls.",
   "Roll the balls in crushed corn flakes and put one on each pineapple slice.",
   "Pour ½ cup melted butter over the balls and sprinkle with paprika.",
   "Bake at 325°F for 30 minutes.",
   "Turn the heat to 400°F and bake 10 minutes longer."
  ],
  "tips": [],
  "ovenTemp": "325°F, then 400°F",
  "cookTime": "40 minutes",
  "yield": null,
  "editorNotes": [
   "Source reads '2z Cups sweet potatoes'; shown as 2½ cups.",
   "Source reads '⅖ Cup sugar'; shown as ⅔ cup (⅖ is not a standard measure).",
   "Source reads 't cup juice' and '≥ cup brown sugar'; both shown as ½ cup (best guess).",
   "The source never says to mash or mix the potato ingredients; that step is implied.",
   "Number of pineapple slices not given; use one per ball."
  ]
 },
 {
  "id": "baked-sweet-potatoes-and-apricots",
  "title": "Baked Sweet Potatoes and Apricots",
  "category": "Vegetables & Sides",
  "book": "central",
  "contributor": "Mrs. Bert C. Hylton",
  "contributorRole": null,
  "city": "Logan",
  "state": "West Virginia",
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "6",
      "item": "sweet potatoes"
     },
     {
      "qty": "1 cup",
      "item": "apricot juice"
     },
     {
      "qty": "1¼ cups",
      "item": "brown sugar"
     },
     {
      "qty": "1 cup",
      "item": "apricots, drained"
     },
     {
      "qty": "1½ Tbsp.",
      "item": "cornstarch"
     },
     {
      "qty": "2 Tbsp.",
      "item": "butter"
     },
     {
      "qty": "1 tsp.",
      "item": "grated orange rind"
     },
     {
      "qty": "½ cup",
      "item": "English walnuts, chopped"
     },
     {
      "qty": "⅛ tsp.",
      "item": "cinnamon"
     }
    ]
   }
  ],
  "steps": [
   "Cook the potatoes until tender.",
   "Drain, slice, remove the skins and arrange in a buttered baking dish.",
   "Combine the sugar, cornstarch, orange rind, cinnamon and apricot juice.",
   "Cook until thick and clear in color.",
   "Stir in the apricots, butter and nuts.",
   "Pour over the potatoes and bake at 375°F for 20–25 minutes."
  ],
  "tips": [],
  "ovenTemp": "375°F",
  "cookTime": "20–25 minutes",
  "yield": null,
  "editorNotes": [
   "Source reads '1+ Cup brown sugar'; shown as 1¼ cups (best guess).",
   "Source reads '1z Tbsp. cornstarch'; shown as 1½ Tbsp.",
   "Source reads '2 Cup chopped walnuts'; shown as ½ cup (likely a dropped fraction)."
  ]
 },
 {
  "id": "applesauce-nut-bread",
  "title": "Applesauce Nut Bread",
  "category": "Breads",
  "book": "central",
  "contributor": null,
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "1 cup",
      "item": "walnuts, chopped"
     },
     {
      "qty": "1",
      "item": "egg, beaten"
     },
     {
      "qty": "1 cup",
      "item": "thick applesauce"
     },
     {
      "qty": "2 Tbsp.",
      "item": "shortening, melted"
     },
     {
      "qty": "3 cups",
      "item": "flour, sifted"
     },
     {
      "qty": "4 tsp.",
      "item": "baking powder"
     },
     {
      "qty": "½ tsp.",
      "item": "salt"
     },
     {
      "qty": "½ tsp.",
      "item": "baking soda"
     },
     {
      "qty": "",
      "item": "cinnamon"
     }
    ]
   }
  ],
  "steps": [
   "Sift together the dry ingredients; add the walnuts.",
   "In a mixing bowl, beat the egg; add the applesauce and shortening.",
   "Add the dry ingredients and stir just until blended.",
   "Pour into a greased 8x4x4-inch loaf pan.",
   "Bake in a moderate oven, 350°F, for 1 hour.",
   "Cool on a rack."
  ],
  "tips": [],
  "ovenTemp": "350°F",
  "cookTime": "1 hour",
  "yield": "1 loaf",
  "editorNotes": [
   "Salt, soda and cinnamon quantities are garbled in the source ('Tsp. salt 12-', 'Tsp. soda 2', 'Tsp. cinnamon'); salt and soda shown as ½ tsp. each (best guess), cinnamon left unspecified.",
   "No contributor or location is printed for this recipe."
  ]
 },
 {
  "id": "english-walnut-roll",
  "title": "English Walnut Roll",
  "category": "Breads",
  "book": "central",
  "contributor": "Mrs. Jennie Kitchen",
  "contributorRole": null,
  "city": "Logan",
  "state": "West Virginia",
  "ingredientGroups": [
   {
    "name": "Dough",
    "items": [
     {
      "qty": "2 cups",
      "item": "flour, sifted"
     },
     {
      "qty": "1 cake",
      "item": "yeast"
     },
     {
      "qty": "1 cup",
      "item": "sugar"
     },
     {
      "qty": "½ tsp.",
      "item": "salt"
     },
     {
      "qty": "¼ lb.",
      "item": "butter, melted"
     },
     {
      "qty": "4",
      "item": "eggs"
     },
     {
      "qty": "2 cups",
      "item": "milk"
     }
    ]
   },
   {
    "name": "Filling",
    "items": [
     {
      "qty": "2 cups",
      "item": "English walnuts, chopped or ground"
     },
     {
      "qty": "¾ cup",
      "item": "sugar"
     }
    ]
   },
   {
    "name": "Also needed",
    "items": [
     {
      "qty": "",
      "item": "egg yolk, for brushing"
     }
    ]
   }
  ],
  "steps": [
   "Combine the flour, yeast, sugar, eggs, salt and melted butter; gradually add the milk.",
   "Knead until the dough is tough and spongy.",
   "Let stand until doubled in bulk, then knead down again.",
   "Roll out portions of dough about 12 inches in diameter, rolling very thin.",
   "Combine ¾ cup sugar with the ground nuts and sprinkle sparingly over the rolled-out dough.",
   "Start rolling at the top of the dough, pressing the ends as you roll.",
   "Put in a greased pan and let stand 30 minutes.",
   "Brush with egg yolk and bake 45 minutes at 350°F."
  ],
  "tips": [
   "Cut when cool."
  ],
  "ovenTemp": "350°F",
  "cookTime": "45 minutes",
  "yield": null,
  "editorNotes": [
   "Source says 'pour sparingly' over the dough; shown as 'sprinkle' since the filling is dry.",
   "Only 2 cups flour for 2 cups milk and 4 eggs makes a very wet dough; the original may have omitted more flour."
  ]
 },
 {
  "id": "auntie-s-applesauce-cake",
  "title": "Auntie's Applesauce Cake",
  "category": "Cakes",
  "book": "central",
  "contributor": "Mrs. Dallas Morrison",
  "contributorRole": null,
  "city": "Logan",
  "state": "West Virginia",
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "1 stick",
      "item": "butter"
     },
     {
      "qty": "2 cups",
      "item": "sugar"
     },
     {
      "qty": "2 cups",
      "item": "applesauce"
     },
     {
      "qty": "½ cup",
      "item": "warm water combined with 2 tsp. baking soda"
     },
     {
      "qty": "1 cup",
      "item": "English walnuts"
     },
     {
      "qty": "1 Tbsp.",
      "item": "vinegar"
     },
     {
      "qty": "3 cups",
      "item": "all-purpose flour"
     },
     {
      "qty": "1 tsp.",
      "item": "cinnamon"
     },
     {
      "qty": "1 tsp.",
      "item": "allspice"
     },
     {
      "qty": "1 cup",
      "item": "seedless raisins"
     },
     {
      "qty": "½ tsp.",
      "item": "salt"
     }
    ]
   }
  ],
  "steps": [
   "Flour the raisins and walnuts with a little of the flour mixture.",
   "Cream the butter and sugar.",
   "Add the applesauce and the water-and-soda mixture, then the vinegar.",
   "Add the sifted dry ingredients and mix well.",
   "Fold in the raisins and walnuts last.",
   "Grease and flour the stem and sides of a tube pan; cut wax paper to fit the bottom.",
   "Bake at 300°F for 1 hour 45 minutes, or until done."
  ],
  "tips": [
   "Let cool completely, wrap in waxed paper and then foil, and let ripen for a day or two."
  ],
  "ovenTemp": "300°F",
  "cookTime": "1 hour 45 minutes",
  "yield": null,
  "editorNotes": [
   "'Stem pan' in the source means a tube pan."
  ]
 },
 {
  "id": "orange-cake",
  "title": "Orange Cake",
  "category": "Cakes",
  "book": "central",
  "contributor": "Mrs. H. Drewey Morrison",
  "contributorRole": null,
  "city": "Logan",
  "state": "West Virginia",
  "ingredientGroups": [
   {
    "name": "Cake",
    "items": [
     {
      "qty": "½ cup",
      "item": "butter"
     },
     {
      "qty": "1 cup",
      "item": "sugar"
     },
     {
      "qty": "",
      "item": "eggs, added one at a time"
     },
     {
      "qty": "2 cups",
      "item": "flour"
     },
     {
      "qty": "¼ tsp.",
      "item": "salt"
     },
     {
      "qty": "1 Tbsp.",
      "item": "grated orange rind"
     },
     {
      "qty": "1½ cups",
      "item": "dates, chopped"
     },
     {
      "qty": "1 cup",
      "item": "pecans"
     },
     {
      "qty": "1 tsp.",
      "item": "baking soda dissolved in ⅔ cup buttermilk"
     }
    ]
   },
   {
    "name": "Glaze",
    "items": [
     {
      "qty": "¾ cup",
      "item": "orange juice"
     },
     {
      "qty": "1 cup",
      "item": "sugar"
     },
     {
      "qty": "1 Tbsp.",
      "item": "orange rind"
     }
    ]
   }
  ],
  "steps": [
   "Line a 9x14-inch pan with oiled paper.",
   "Mix the cake ingredients and pour into the pan.",
   "Bake 40 minutes at 325°F.",
   "While hot, pour the orange juice, sugar and orange rind over the cake."
  ],
  "tips": [],
  "ovenTemp": "325°F",
  "cookTime": "40 minutes",
  "yield": null,
  "editorNotes": [
   "Number of eggs is missing in the source.",
   "Source reads '4 Tsp. salt'; shown as ¼ tsp. (4 tsp. would be far too much; likely a dropped fraction).",
   "Source reads '1z Cups chopped dates'; shown as 1½ cups.",
   "No mixing method is given; cream the butter and sugar, add eggs, then alternate the flour with the soda-buttermilk, and fold in dates and pecans."
  ]
 },
 {
  "id": "applesauce-cake",
  "title": "Applesauce Cake",
  "category": "Cakes",
  "book": "central",
  "contributor": "Mrs. Frederic W. Spencer",
  "contributorRole": "President, California Federation of Women's Clubs",
  "city": null,
  "state": "California",
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "½ cup",
      "item": "shortening, creamed"
     },
     {
      "qty": "1 cup",
      "item": "sugar"
     },
     {
      "qty": "1 cup",
      "item": "applesauce"
     },
     {
      "qty": "1 tsp.",
      "item": "baking soda"
     },
     {
      "qty": "½ tsp.",
      "item": "salt"
     },
     {
      "qty": "½ cup",
      "item": "walnuts, chopped"
     },
     {
      "qty": "½ tsp.",
      "item": "cinnamon"
     },
     {
      "qty": "½ tsp.",
      "item": "nutmeg"
     },
     {
      "qty": "½ tsp.",
      "item": "ginger"
     },
     {
      "qty": "2 Tbsp.",
      "item": "baking powder"
     },
     {
      "qty": "1 cup",
      "item": "raisins (optional)"
     }
    ]
   }
  ],
  "steps": [
   "Beat the cake batter smooth.",
   "Pour into greased and floured layer cake pans and bake at 350°F for 35 minutes.",
   "Or pour into a greased and floured sheet cake pan and bake 50–60 minutes, until the cake tests done."
  ],
  "tips": [
   "May be served plain or iced with white vanilla icing or brown sugar icing."
  ],
  "ovenTemp": "350°F",
  "cookTime": "35 minutes (layers) or 50–60 minutes (sheet)",
  "yield": null,
  "editorNotes": [
   "No flour is listed, yet the recipe is a cake batter; the flour amount appears to be missing from the source.",
   "'1 cup sugar blend' in the source is unclear; shown as sugar.",
   "2 Tbsp. baking powder is unusually high; may have been 2 tsp.",
   "No eggs are listed."
  ]
 },
 {
  "id": "orange-date-cake",
  "title": "Orange-Date Cake",
  "category": "Cakes",
  "book": "central",
  "contributor": "Mrs. Todd C. Willis, Sr.",
  "contributorRole": null,
  "city": "Yolyn",
  "state": "West Virginia",
  "ingredientGroups": [
   {
    "name": "Cake",
    "items": [
     {
      "qty": "1 (7 oz.) pkg.",
      "item": "dates, chopped"
     },
     {
      "qty": "4 cups",
      "item": "all-purpose flour"
     },
     {
      "qty": "1 cup",
      "item": "pecans, chopped"
     },
     {
      "qty": "4",
      "item": "eggs, separated"
     },
     {
      "qty": "1 cup",
      "item": "shortening or butter"
     },
     {
      "qty": "1⅓ cups",
      "item": "buttermilk"
     },
     {
      "qty": "2 cups",
      "item": "sugar"
     },
     {
      "qty": "1 tsp.",
      "item": "baking soda"
     },
     {
      "qty": "2 Tbsp.",
      "item": "grated orange rind"
     }
    ]
   },
   {
    "name": "Topping",
    "items": [
     {
      "qty": "2 cups",
      "item": "sugar"
     },
     {
      "qty": "1 cup",
      "item": "orange juice"
     },
     {
      "qty": "2 Tbsp.",
      "item": "grated orange rind"
     }
    ]
   }
  ],
  "steps": [
   "Mix the topping first: stir the sugar, orange juice and rind occasionally to dissolve the sugar. Do not cook.",
   "Dredge the dates and nuts in a small amount of the flour.",
   "Cream the shortening, adding the sugar gradually, and cream well.",
   "Add the beaten egg yolks.",
   "Sift the flour 3 times. Dissolve the soda in the buttermilk.",
   "Add the flour alternately with the buttermilk.",
   "Fold in the floured dates and nuts and the orange rind.",
   "Fold in the stiffly beaten egg whites.",
   "Bake at 300°F for 1½ hours.",
   "While the cake is still hot from the oven, puncture holes all over the top with an ice pick.",
   "Strain the topping and pour it over the cake. Leave the cake in the pan so the topping soaks in."
  ],
  "tips": [],
  "ovenTemp": "300°F",
  "cookTime": "1½ hours",
  "yield": null,
  "editorNotes": [
   "Quantities for pecans and shortening are missing in the source ('Cup pecans', 'Cup shortening'); shown as 1 cup each (best guess).",
   "Topping orange juice amount is garbled ('\" Cup'); shown as 1 cup (best guess).",
   "Source reads 'lz hours'; shown as 1½ hours.",
   "Pan size is not given; a 10-inch tube pan fits this volume."
  ]
 },
 {
  "id": "banana-prune-cake",
  "title": "Banana-Prune Cake",
  "category": "Cakes",
  "book": "central",
  "contributor": "Mrs. Robert L. Boone",
  "contributorRole": null,
  "city": "Bluefield",
  "state": "Virginia",
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "⅔ cup",
      "item": "shortening"
     },
     {
      "qty": "2½ cups",
      "item": "sifted cake flour"
     },
     {
      "qty": "1½ cups",
      "item": "sugar"
     },
     {
      "qty": "1 tsp.",
      "item": "baking powder"
     },
     {
      "qty": "1 tsp.",
      "item": "baking soda"
     },
     {
      "qty": "1 tsp.",
      "item": "salt"
     },
     {
      "qty": "1 cup",
      "item": "mashed bananas"
     },
     {
      "qty": "⅔ cup",
      "item": "milk"
     },
     {
      "qty": "2",
      "item": "eggs"
     },
     {
      "qty": "1 cup",
      "item": "cooked prunes, chopped"
     },
     {
      "qty": "½ cup",
      "item": "walnuts, chopped"
     }
    ]
   },
   {
    "name": "Also needed",
    "items": [
     {
      "qty": "",
      "item": "brown sugar frosting"
     },
     {
      "qty": "",
      "item": "walnut halves, for garnish"
     }
    ]
   }
  ],
  "steps": [
   "Stir the shortening just to soften; sift in the dry ingredients.",
   "Add the bananas and half the milk; mix until all the flour is dampened, then beat vigorously 2 minutes.",
   "Add the eggs and remaining milk and beat 2 minutes.",
   "Fold in the prunes and nuts.",
   "Pour into a paper-lined 13x9x2-inch pan.",
   "Bake in a moderate oven, 350°F, for 40–45 minutes.",
   "Let stand in the pan about 10 minutes before removing.",
   "When cool, cover with brown sugar frosting and trim with walnut halves."
  ],
  "tips": [],
  "ovenTemp": "350°F",
  "cookTime": "40–45 minutes",
  "yield": null,
  "editorNotes": [
   "Source reads 'Add bananas and 2 the milk'; read as 'half the milk'.",
   "No brown sugar frosting recipe is given."
  ]
 },
 {
  "id": "prune-cake",
  "title": "Prune Cake",
  "category": "Cakes",
  "book": "central",
  "contributor": "Mrs. C. E. Browning",
  "contributorRole": null,
  "city": "Logan",
  "state": "West Virginia",
  "ingredientGroups": [
   {
    "name": "Cake",
    "items": [
     {
      "qty": "1½ cups",
      "item": "sugar"
     },
     {
      "qty": "1 cup",
      "item": "salad oil"
     },
     {
      "qty": "3",
      "item": "eggs"
     },
     {
      "qty": "1 cup",
      "item": "buttermilk"
     },
     {
      "qty": "2 cups",
      "item": "flour"
     },
     {
      "qty": "1 tsp.",
      "item": "cinnamon"
     },
     {
      "qty": "1 tsp.",
      "item": "allspice"
     },
     {
      "qty": "1 cup",
      "item": "pecans, chopped"
     },
     {
      "qty": "1 tsp.",
      "item": "baking soda"
     },
     {
      "qty": "1 tsp.",
      "item": "salt"
     },
     {
      "qty": "1 tsp.",
      "item": "vanilla"
     }
    ]
   },
   {
    "name": "Topping",
    "items": [
     {
      "qty": "1 cup",
      "item": "sugar"
     },
     {
      "qty": "½ cup",
      "item": "buttermilk"
     },
     {
      "qty": "⅓ cup",
      "item": "butter"
     },
     {
      "qty": "",
      "item": "baking soda"
     },
     {
      "qty": "",
      "item": "vanilla"
     }
    ]
   }
  ],
  "steps": [
   "Beat the cake ingredients by hand with a mixing spoon until well blended.",
   "Pour into a greased 10x4-inch pan.",
   "Bake 45 minutes at 350°F.",
   "For the topping, combine the sugar, buttermilk, butter and soda in a saucepan and cook over medium heat until syrupy.",
   "Add the vanilla.",
   "Prick the baked cake with a fork and pour the topping over so it soaks in."
  ],
  "tips": [
   "Serve from the pan."
  ],
  "ovenTemp": "350°F",
  "cookTime": "45 minutes",
  "yield": null,
  "editorNotes": [
   "Despite the name, no prunes are listed in the ingredients; they appear to be missing from the source (compare Bit O'Spice Prune Cake).",
   "Topping soda and vanilla quantities are missing ('Tsp. soda', 'Tsp. vanilla'); likely 1 tsp. each.",
   "'10x4 inch pan' is likely a 10-inch tube pan, 4 inches deep."
  ]
 },
 {
  "id": "bit-o-spice-prune-cake",
  "title": "Bit O'Spice Prune Cake",
  "category": "Cakes",
  "book": "central",
  "contributor": "Mrs. S. A. Ammar",
  "contributorRole": null,
  "city": "Logan",
  "state": "West Virginia",
  "ingredientGroups": [
   {
    "name": "Cake",
    "items": [
     {
      "qty": "2 cups",
      "item": "flour"
     },
     {
      "qty": "1 tsp.",
      "item": "baking soda"
     },
     {
      "qty": "1 tsp.",
      "item": "nutmeg"
     },
     {
      "qty": "1 tsp.",
      "item": "salt"
     },
     {
      "qty": "1 tsp.",
      "item": "cinnamon"
     },
     {
      "qty": "¼ tsp.",
      "item": "allspice"
     },
     {
      "qty": "1½ cups",
      "item": "sugar"
     },
     {
      "qty": "1 cup",
      "item": "cooking oil"
     },
     {
      "qty": "3",
      "item": "eggs"
     },
     {
      "qty": "1 cup",
      "item": "buttermilk"
     },
     {
      "qty": "1 tsp.",
      "item": "vanilla"
     },
     {
      "qty": "1 cup",
      "item": "cooked prunes, chopped"
     },
     {
      "qty": "1 cup",
      "item": "pecans, chopped"
     }
    ]
   },
   {
    "name": "Topping",
    "items": [
     {
      "qty": "1 cup",
      "item": "sugar"
     },
     {
      "qty": "1 cup",
      "item": "buttermilk"
     },
     {
      "qty": "½ cup",
      "item": "butter"
     },
     {
      "qty": "1 tsp.",
      "item": "baking soda"
     }
    ]
   }
  ],
  "steps": [
   "Sift the flour, soda, salt, nutmeg, cinnamon and allspice.",
   "Add the sugar, oil, eggs, buttermilk and vanilla; beat until smooth.",
   "Stir in the prunes and pecans.",
   "Pour into a greased 13x9x2-inch baking pan.",
   "Bake at 350°F for 45 minutes.",
   "Heat the topping ingredients to boiling.",
   "Pour over the cake, piercing it with a toothpick until the topping is absorbed."
  ],
  "tips": [],
  "ovenTemp": "350°F",
  "cookTime": "45 minutes",
  "yield": null,
  "editorNotes": [
   "The ingredient list says 'baking powder' but the method sifts in soda; shown as baking soda.",
   "Source lists '1 cup chopped pecans, cook' and then '1 cup chopped pecans'; the first is read as 1 cup cooked, chopped prunes."
  ]
 },
 {
  "id": "nut-cake",
  "title": "Nut Cake",
  "category": "Cakes",
  "book": "central",
  "contributor": "Mrs. Wayne E. Watren",
  "contributorRole": null,
  "city": "Stollings",
  "state": "West Virginia",
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "¾ cup",
      "item": "sugar"
     },
     {
      "qty": "½ lb.",
      "item": "butter, melted"
     },
     {
      "qty": "3",
      "item": "eggs, beaten"
     },
     {
      "qty": "¾ lb.",
      "item": "flour, sifted"
     },
     {
      "qty": "1½ tsp.",
      "item": "baking powder"
     },
     {
      "qty": "1 lb.",
      "item": "white raisins"
     },
     {
      "qty": "1 qt.",
      "item": "pecans"
     },
     {
      "qty": "¼ lb.",
      "item": "crystallized cherries"
     },
     {
      "qty": "¼ lb.",
      "item": "crystallized pineapple"
     },
     {
      "qty": "⅛ lb.",
      "item": "orange peel"
     }
    ]
   }
  ],
  "steps": [
   "Grease a tube pan and line it with 2 thicknesses of brown paper.",
   "Melt the butter; add the sugar, beaten eggs, flour and other ingredients and beat well.",
   "Pack into the pan.",
   "Bake on the 4th rack from the bottom at 350°F for 2¾ hours, with a pan of water under the cake the whole time.",
   "Test with a straw."
  ],
  "tips": [
   "Can also be baked in 2 loaf pans or 3 coffee cans."
  ],
  "ovenTemp": "350°F",
  "cookTime": "2¾ hours",
  "yield": null,
  "editorNotes": [
   "350°F for 2¾ hours is unusually hot for a fruitcake; 250–275°F may have been intended.",
   "Source says 'Bake in 2 loaf pans for 24 hours'; clearly an error — baking time for loaf pans is not given."
  ]
 },
 {
  "id": "icebox-fruit-cake",
  "title": "Icebox Fruit Cake",
  "category": "Desserts",
  "book": "central",
  "contributor": "Mrs. Fannie Mertz",
  "contributorRole": null,
  "city": "Americus",
  "state": "Georgia",
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "1 can",
      "item": "evaporated milk"
     },
     {
      "qty": "1 lb. box",
      "item": "vanilla wafers"
     },
     {
      "qty": "½ cup",
      "item": "raisins"
     },
     {
      "qty": "1 qt.",
      "item": "pecans, chopped"
     },
     {
      "qty": "1 small bottle",
      "item": "maraschino cherries"
     },
     {
      "qty": "5 Tbsp.",
      "item": "water"
     }
    ]
   }
  ],
  "steps": [
   "Combine all ingredients, mixing well.",
   "Put into a covered casserole dish.",
   "Refrigerate until well chilled before using."
  ],
  "tips": [],
  "ovenTemp": null,
  "cookTime": null,
  "yield": null,
  "editorNotes": [
   "Source reads '1/2 cups raisins'; whole number may be missing (could be 1½ cups).",
   "Vanilla wafers are presumably crushed; the source does not say."
  ]
 },
 {
  "id": "walnut-butter-spice-cake",
  "title": "Walnut Butter Spice Cake",
  "category": "Cakes",
  "book": "central",
  "contributor": "Mrs. A. B. Bias",
  "contributorRole": null,
  "city": "West Logan",
  "state": "West Virginia",
  "ingredientGroups": [
   {
    "name": "Cake",
    "items": [
     {
      "qty": "2 cups",
      "item": "sifted cake flour"
     },
     {
      "qty": "½ tsp.",
      "item": "cloves"
     },
     {
      "qty": "1 tsp.",
      "item": "baking soda"
     },
     {
      "qty": "½ tsp.",
      "item": "nutmeg"
     },
     {
      "qty": "1 tsp.",
      "item": "cinnamon"
     },
     {
      "qty": "1 tsp.",
      "item": "baking powder"
     },
     {
      "qty": "½ cup",
      "item": "butter"
     },
     {
      "qty": "¾ cup",
      "item": "light brown sugar"
     },
     {
      "qty": "¾ cup",
      "item": "granulated sugar"
     },
     {
      "qty": "1 cup",
      "item": "buttermilk"
     },
     {
      "qty": "1 cup",
      "item": "walnut meats, chopped"
     },
     {
      "qty": "3",
      "item": "eggs"
     }
    ]
   },
   {
    "name": "Frosting",
    "items": [
     {
      "qty": "1 lb. pkg.",
      "item": "confectioners' (XXX) sugar, sifted"
     },
     {
      "qty": "½ cup",
      "item": "butter (1 stick)"
     },
     {
      "qty": "1",
      "item": "egg"
     },
     {
      "qty": "1 tsp.",
      "item": "vanilla"
     },
     {
      "qty": "⅛ tsp.",
      "item": "salt"
     },
     {
      "qty": "1 Tbsp.",
      "item": "milk or cream"
     }
    ]
   },
   {
    "name": "Also needed",
    "items": [
     {
      "qty": "",
      "item": "walnut halves, for garnish"
     }
    ]
   }
  ],
  "steps": [
   "Sift together the dry ingredients.",
   "Cream the butter with the brown and white sugar.",
   "Add the eggs one at a time, beating well after each.",
   "Add the sifted dry ingredients alternately with the buttermilk.",
   "Fold in the nuts.",
   "Pour into 2 buttered and floured layer pans.",
   "Bake in a preheated 375°F oven for 30–35 minutes.",
   "For the frosting, cream the butter until smooth and add ⅓ of the sugar; cream well.",
   "Add the egg, vanilla, salt and milk; beat until smooth.",
   "Add the remaining sugar and beat until smooth and fluffy.",
   "Frost the cake and garnish with walnut halves."
  ],
  "tips": [],
  "ovenTemp": "375°F",
  "cookTime": "30–35 minutes",
  "yield": "2 layers",
  "editorNotes": [
   "Source reads '12 Cup butter, l stick'; shown as ½ cup (1 stick).",
   "The frosting uses a raw egg."
  ]
 },
 {
  "id": "jam-cake",
  "title": "Jam Cake",
  "category": "Cakes",
  "book": "central",
  "contributor": "Mrs. Haskell Worf",
  "contributorRole": null,
  "city": "Stollings",
  "state": "West Virginia",
  "ingredientGroups": [
   {
    "name": "Cake",
    "items": [
     {
      "qty": "2 cups",
      "item": "sugar"
     },
     {
      "qty": "1 cup",
      "item": "shortening"
     },
     {
      "qty": "3",
      "item": "eggs"
     },
     {
      "qty": "1 cup",
      "item": "buttermilk"
     },
     {
      "qty": "1 cup",
      "item": "berry jam"
     },
     {
      "qty": "3 cups",
      "item": "flour, sifted"
     },
     {
      "qty": "1 tsp.",
      "item": "baking soda"
     },
     {
      "qty": "1 cup",
      "item": "nuts, chopped"
     },
     {
      "qty": "1 cup",
      "item": "raisins"
     },
     {
      "qty": "1 cup",
      "item": "coconut, ground"
     },
     {
      "qty": "1 large",
      "item": "apple, grated"
     },
     {
      "qty": "",
      "item": "dates, chopped (optional)"
     }
    ]
   },
   {
    "name": "Filling",
    "items": [
     {
      "qty": "2 cups",
      "item": "sugar"
     },
     {
      "qty": "2 tsp.",
      "item": "flour"
     },
     {
      "qty": "1½ cups",
      "item": "sweet milk"
     },
     {
      "qty": "1 cup",
      "item": "butter or margarine"
     },
     {
      "qty": "1 cup",
      "item": "nuts, chopped"
     },
     {
      "qty": "1 cup",
      "item": "raisins, chopped"
     },
     {
      "qty": "1 cup",
      "item": "coconut, grated"
     },
     {
      "qty": "1 cup",
      "item": "apple, grated"
     }
    ]
   },
   {
    "name": "Also needed",
    "items": [
     {
      "qty": "",
      "item": "maraschino cherries, for decorating (optional)"
     }
    ]
   }
  ],
  "steps": [
   "Cream the sugar and shortening; add the eggs and beat well.",
   "Combine the buttermilk and jam.",
   "Add the buttermilk mixture alternately with the sifted flour and soda; beat well.",
   "Add the nuts, fruits and coconut; stir until well distributed through the batter.",
   "Bake in three 9-inch layer pans for 30–40 minutes at 350°F.",
   "For the filling, mix the sugar and flour; add the milk and butter and cook until thick, stirring occasionally.",
   "Remove from heat and add the nuts, fruit and coconut.",
   "Spread between the layers and on the top and sides of the cake."
  ],
  "tips": [
   "Decorate with maraschino cherries if desired."
  ],
  "ovenTemp": "350°F",
  "cookTime": "30–40 minutes",
  "yield": "3 layers",
  "editorNotes": []
 },
 {
  "id": "banana-cake",
  "title": "Banana Cake",
  "category": "Cakes",
  "book": "central",
  "contributor": "Mrs. Edmund G. Brown",
  "contributorRole": "Executive Mansion",
  "city": "Sacramento",
  "state": "California",
  "ingredientGroups": [
   {
    "name": "Cake",
    "items": [
     {
      "qty": "½ cup",
      "item": "butter"
     },
     {
      "qty": "1½ cups",
      "item": "sugar"
     },
     {
      "qty": "2",
      "item": "eggs, separated"
     },
     {
      "qty": "½ cup",
      "item": "sour milk (or ¾ cup buttermilk)"
     },
     {
      "qty": "1 tsp.",
      "item": "baking soda"
     },
     {
      "qty": "2 cups",
      "item": "flour"
     },
     {
      "qty": "2 tsp.",
      "item": "baking powder"
     },
     {
      "qty": "3",
      "item": "bananas, mashed"
     },
     {
      "qty": "1 tsp.",
      "item": "vanilla"
     },
     {
      "qty": "1 cup",
      "item": "walnuts, chopped"
     }
    ]
   },
   {
    "name": "Icing",
    "items": [
     {
      "qty": "2 Tbsp.",
      "item": "butter"
     },
     {
      "qty": "1 tsp.",
      "item": "vanilla"
     },
     {
      "qty": "1½ cups",
      "item": "confectioners' sugar"
     },
     {
      "qty": "",
      "item": "cream or top milk"
     },
     {
      "qty": "1",
      "item": "whole egg"
     }
    ]
   }
  ],
  "steps": [
   "Cream the butter and sugar.",
   "Add the egg yolks, then the milk with the soda; mix.",
   "Add the flour and baking powder, sifted together.",
   "Add the vanilla, bananas and nuts and beat well.",
   "Fold in the beaten egg whites.",
   "Bake in 3 greased layer pans at 325°F for about ½ hour.",
   "For the icing, cream the butter and sugar; add the egg and mix.",
   "Add the vanilla, then add cream until the icing is the right consistency to spread."
  ],
  "tips": [],
  "ovenTemp": "325°F",
  "cookTime": "About 30 minutes",
  "yield": "3 layers",
  "editorNotes": [
   "Source reads '1/2 cups butter'; shown as ½ cup.",
   "Source reads 'aboutz hour'; shown as about ½ hour.",
   "The icing uses a raw egg."
  ]
 },
 {
  "id": "graham-cracker-cake",
  "title": "Graham Cracker Cake",
  "category": "Cakes",
  "book": "central",
  "contributor": "Mrs. Charles Hudson",
  "contributorRole": null,
  "city": "McConnell",
  "state": "West Virginia",
  "ingredientGroups": [
   {
    "name": "Cake",
    "items": [
     {
      "qty": "½ cup",
      "item": "shortening"
     },
     {
      "qty": "1 cup",
      "item": "sugar"
     },
     {
      "qty": "3",
      "item": "egg yolks"
     },
     {
      "qty": "2 tsp.",
      "item": "flour"
     },
     {
      "qty": "½ tsp.",
      "item": "salt"
     },
     {
      "qty": "2 tsp.",
      "item": "baking powder"
     },
     {
      "qty": "30",
      "item": "graham crackers, rolled into crumbs"
     },
     {
      "qty": "1 cup",
      "item": "milk"
     },
     {
      "qty": "1 cup",
      "item": "nuts, chopped"
     },
     {
      "qty": "3",
      "item": "egg whites, beaten stiff"
     }
    ]
   },
   {
    "name": "Frosting",
    "items": [
     {
      "qty": "1½ cups",
      "item": "powdered sugar"
     },
     {
      "qty": "1 Tbsp.",
      "item": "coffee"
     },
     {
      "qty": "½ tsp.",
      "item": "salt"
     },
     {
      "qty": "4 Tbsp.",
      "item": "cocoa"
     },
     {
      "qty": "¼ cup",
      "item": "butter"
     },
     {
      "qty": "1 tsp.",
      "item": "vanilla"
     },
     {
      "qty": "1",
      "item": "egg yolk"
     }
    ]
   },
   {
    "name": "Also needed",
    "items": [
     {
      "qty": "",
      "item": "strawberry preserves, for between the layers"
     }
    ]
   }
  ],
  "steps": [
   "Cream the shortening and sugar thoroughly.",
   "Add the egg yolks and beat until fluffy.",
   "Mix the cracker crumbs with the sifted flour, salt and baking powder.",
   "Add alternately with the milk.",
   "Fold in the nut meats and egg whites.",
   "Bake in 2 greased 8-inch layer pans in a moderate oven, 350°F, for 30 minutes.",
   "Spread strawberry preserves between the layers.",
   "For the frosting, sift the sugar. Cream the butter, add the sugar and beat until smooth.",
   "Add the remaining ingredients and beat until well blended."
  ],
  "tips": [],
  "ovenTemp": "350°F",
  "cookTime": "30 minutes",
  "yield": "2 layers",
  "editorNotes": [
   "Source reads '4 Cup butter' in the frosting; shown as ¼ cup (likely a dropped fraction).",
   "'2 Tsp. flour' is small but plausible, since the graham crumbs replace most of the flour.",
   "The frosting uses a raw egg yolk."
  ]
 },
 {
  "id": "apple-cake",
  "title": "Apple Cake",
  "category": "Cakes",
  "book": "central",
  "contributor": "Mrs. George Hoyman",
  "contributorRole": null,
  "city": "Gassaway",
  "state": "West Virginia",
  "ingredientGroups": [
   {
    "name": "First mixture",
    "items": [
     {
      "qty": "4 cups",
      "item": "apples, cubed"
     },
     {
      "qty": "2 cups",
      "item": "sugar"
     }
    ]
   },
   {
    "name": "Batter",
    "items": [
     {
      "qty": "2 cups",
      "item": "flour"
     },
     {
      "qty": "1 cup",
      "item": "oil"
     },
     {
      "qty": "2 tsp.",
      "item": "baking soda"
     },
     {
      "qty": "2 tsp.",
      "item": "vanilla"
     },
     {
      "qty": "½ tsp.",
      "item": "salt"
     },
     {
      "qty": "1 cup",
      "item": "nuts"
     },
     {
      "qty": "2",
      "item": "eggs"
     }
    ]
   }
  ],
  "steps": [
   "Mix the apples and sugar together and let stand for one hour.",
   "Mix the batter ingredients with the apple mixture.",
   "Place in a greased, floured pan.",
   "Bake for an hour at 350°F."
  ],
  "tips": [],
  "ovenTemp": "350°F",
  "cookTime": "1 hour",
  "yield": null,
  "editorNotes": [
   "Pan size not given; a 13x9-inch pan or tube pan suits this batter."
  ]
 },
 {
  "id": "texas-steam-pecan-nut-cake",
  "title": "Texas Steam Pecan Nut Cake",
  "category": "Cakes",
  "book": "central",
  "contributor": "Mrs. Ed Elkins",
  "contributorRole": null,
  "city": "Logan",
  "state": "West Virginia",
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "4 cups",
      "item": "all-purpose flour"
     },
     {
      "qty": "1 lb.",
      "item": "butter"
     },
     {
      "qty": "1 lb.",
      "item": "sugar"
     },
     {
      "qty": "1 lb.",
      "item": "pecan nut meats"
     },
     {
      "qty": "6",
      "item": "eggs"
     },
     {
      "qty": "1 lb.",
      "item": "white raisins"
     },
     {
      "qty": "1 small bottle",
      "item": "lemon extract"
     }
    ]
   }
  ],
  "steps": [
   "Mix the nut meats and raisins with 1 cup of the flour.",
   "Cream the butter, adding the sugar a little at a time.",
   "Add the eggs one at a time, mixing well.",
   "Add the remaining flour.",
   "Add the bottle of extract, then the nuts and raisins.",
   "Bake in a tube pan for 3 hours at 250°F with a pan of water in the oven."
  ],
  "tips": [],
  "ovenTemp": "250°F",
  "cookTime": "3 hours",
  "yield": null,
  "editorNotes": [
   "'Small bottle' of lemon extract is likely 1 oz. (2 Tbsp.); confirm before baking."
  ]
 },
 {
  "id": "golden-fruit-cake",
  "title": "Golden Fruit Cake",
  "category": "Cakes",
  "book": "central",
  "contributor": "Mrs. C. E. Neville",
  "contributorRole": null,
  "city": "Huntington",
  "state": "West Virginia",
  "ingredientGroups": [
   {
    "name": "Fruit and nuts",
    "items": [
     {
      "qty": "½ lb.",
      "item": "light dates, cut"
     },
     {
      "qty": "½ lb.",
      "item": "light figs, cut"
     },
     {
      "qty": "½ lb.",
      "item": "sultana raisins"
     },
     {
      "qty": "12",
      "item": "soft dried apricots, cut"
     },
     {
      "qty": "¼ lb.",
      "item": "citron"
     },
     {
      "qty": "⅛ lb.",
      "item": "orange peel"
     },
     {
      "qty": "⅛ lb.",
      "item": "lemon peel"
     },
     {
      "qty": "⅛ lb.",
      "item": "candied ginger"
     },
     {
      "qty": "¼ lb.",
      "item": "blanched almonds"
     },
     {
      "qty": "¼ lb.",
      "item": "Brazil nut meats"
     },
     {
      "qty": "¼ lb.",
      "item": "pecans"
     },
     {
      "qty": "1¼",
      "item": "rounds candied pineapple"
     },
     {
      "qty": "¼ lb.",
      "item": "candied cherries"
     }
    ]
   },
   {
    "name": "Batter",
    "items": [
     {
      "qty": "½ lb.",
      "item": "butter"
     },
     {
      "qty": "½ lb.",
      "item": "white sugar"
     },
     {
      "qty": "2½ cups",
      "item": "flour"
     },
     {
      "qty": "1 tsp.",
      "item": "baking powder"
     },
     {
      "qty": "5",
      "item": "eggs"
     },
     {
      "qty": "⅜ cup",
      "item": "sherry, plus more for soaking"
     }
    ]
   }
  ],
  "steps": [
   "Cream the butter and add the sugar.",
   "Beat in half the eggs.",
   "Add the flour (sifted with the baking powder) alternately with the remaining eggs.",
   "Add the sherry, then the floured fruits and nuts.",
   "Bake at 275°F.",
   "Soak the finished cake in sherry."
  ],
  "tips": [
   "Makes a cake weighing about 4 pounds."
  ],
  "ovenTemp": "275°F",
  "cookTime": null,
  "yield": "About 4 lb.",
  "editorNotes": [
   "Baking time and pan size are not given.",
   "Source reads '1 1/4 rounded pineapple'; read as 1¼ rounds (rings) of candied pineapple.",
   "Source reads '1/8 candied ginger' with no unit; shown as ⅛ lb.",
   "'Soak in sherry' is ambiguous — could mean soaking the fruit before mixing or the baked cake; shown as soaking the cake."
  ]
 },
 {
  "id": "date-orange-cake",
  "title": "Date Orange Cake",
  "category": "Cakes",
  "book": "central",
  "contributor": "Mrs. J. R. Hartzog, Sr.",
  "contributorRole": null,
  "city": "Williamson",
  "state": "West Virginia",
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "½ cup",
      "item": "hot water"
     },
     {
      "qty": "1 tsp.",
      "item": "baking soda"
     },
     {
      "qty": "1 pkg.",
      "item": "dates, cut fine"
     },
     {
      "qty": "1 cup",
      "item": "sugar"
     },
     {
      "qty": "1 stick",
      "item": "butter"
     },
     {
      "qty": "2",
      "item": "eggs, unbeaten"
     },
     {
      "qty": "½ cup",
      "item": "buttermilk"
     },
     {
      "qty": "2 cups",
      "item": "flour"
     },
     {
      "qty": "",
      "item": "pinch of salt"
     },
     {
      "qty": "1 cup",
      "item": "walnuts"
     },
     {
      "qty": "1",
      "item": "orange rind, grated"
     }
    ]
   },
   {
    "name": "Orange glaze",
    "items": [
     {
      "qty": "⅔ cup",
      "item": "orange juice"
     },
     {
      "qty": "",
      "item": "sugar"
     }
    ]
   }
  ],
  "steps": [
   "Mix the hot water and soda and pour over the cut-up dates. Let stand while mixing the other ingredients.",
   "Cream the sugar and butter, then add the eggs.",
   "Add the buttermilk and the flour with salt, then the walnuts and grated rind.",
   "Add this batter to the date mixture.",
   "Pour into a tube pan and bake at 350°F for 40 minutes.",
   "While the cake bakes, pour the orange juice over the sugar and let stand.",
   "Pour the orange mixture over the cake while it is still hot in the pan. Let cool before removing from the pan."
  ],
  "tips": [],
  "ovenTemp": "350°F",
  "cookTime": "40 minutes",
  "yield": null,
  "editorNotes": [
   "Butter is printed as \"Stick butter\" with no number; 1 stick is a best guess.",
   "Orange juice is printed as \"⅖ cup\", a garbled fraction; ⅔ cup is a best guess.",
   "Sugar for the glaze is printed as \"cup sugar\" with no quantity."
  ]
 },
 {
  "id": "nut-and-fruit-cake",
  "title": "Nut and Fruit Cake",
  "category": "Cakes",
  "book": "central",
  "contributor": "Mrs. A. T. Cableton",
  "contributorRole": "President, State Federation",
  "city": "Austin",
  "state": "Texas",
  "ingredientGroups": [
   {
    "name": "White part",
    "items": [
     {
      "qty": "8",
      "item": "egg whites"
     },
     {
      "qty": "2 cups",
      "item": "sugar"
     },
     {
      "qty": "1 cup",
      "item": "butter"
     },
     {
      "qty": "1 cup",
      "item": "sweet milk"
     },
     {
      "qty": "3 cups",
      "item": "flour"
     },
     {
      "qty": "1 Tbsp.",
      "item": "baking powder"
     },
     {
      "qty": "1 cup",
      "item": "pecans, cut"
     },
     {
      "qty": "1 cup",
      "item": "almonds, blanched and cut"
     },
     {
      "qty": "1 cup",
      "item": "canned cherries, cut"
     }
    ]
   },
   {
    "name": "Dark part",
    "items": [
     {
      "qty": "8",
      "item": "egg yolks"
     },
     {
      "qty": "2 cups",
      "item": "sugar"
     },
     {
      "qty": "1 cup",
      "item": "butter"
     },
     {
      "qty": "1 cup",
      "item": "sweet milk"
     },
     {
      "qty": "3 cups",
      "item": "flour"
     },
     {
      "qty": "1 Tbsp.",
      "item": "baking powder"
     },
     {
      "qty": "½ tsp. each",
      "item": "cloves, cinnamon and nutmeg"
     },
     {
      "qty": "1 lb.",
      "item": "seeded raisins"
     }
    ]
   },
   {
    "name": "Filling",
    "items": [
     {
      "qty": "1 pkg.",
      "item": "coconut (or fresh)"
     },
     {
      "qty": "2",
      "item": "lemons, juice and grated rind"
     },
     {
      "qty": "3",
      "item": "egg whites"
     },
     {
      "qty": "",
      "item": "sugar"
     },
     {
      "qty": "",
      "item": "water"
     }
    ]
   }
  ],
  "steps": [
   "White part: Cream the butter and add the sugar. Add the milk alternately with the flour sifted with the baking powder.",
   "Fold in the beaten egg whites and the nuts. Bake in layers at 350°F.",
   "Dark part: Make the same way, but beat the egg yolks and sift the spices with the flour and baking powder. Bake in layers.",
   "Filling: Cook sugar and water until the syrup spins a thread.",
   "Pour the syrup slowly over the beaten egg whites and beat until stiff.",
   "Add the coconut and the lemon juice and grated rind.",
   "Spread the filling between the layers, alternating white and dark layers."
  ],
  "tips": [],
  "ovenTemp": "350°F",
  "cookTime": null,
  "yield": null,
  "editorNotes": [
   "City is printed as \"Auston\"; corrected to Austin.",
   "The white-part list is scrambled in the source (\"3 cups of flour tbs. baking / 1 tbs. powder cup / 1 pecans\"); read as 3 cups flour, 1 Tbsp. baking powder, 1 cup pecans.",
   "Raisins are printed as \"lb. of seeded raisins\" with no number; 1 lb. is a best guess.",
   "The filling calls for sugar and water but gives no amounts.",
   "The source says the cherries are canned; drain them before using is implied but not stated.",
   "No baking time is given."
  ]
 },
 {
  "id": "christmas-fruit-cookies",
  "title": "Christmas Fruit Cookies",
  "category": "Cookies & Bars",
  "book": "central",
  "contributor": "Mrs. James Mulkey",
  "contributorRole": null,
  "city": "Dehue",
  "state": "West Virginia",
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "1½ cups",
      "item": "brown sugar"
     },
     {
      "qty": "½ cup",
      "item": "granulated sugar"
     },
     {
      "qty": "1 lb.",
      "item": "real butter"
     },
     {
      "qty": "3",
      "item": "eggs"
     },
     {
      "qty": "1 tsp.",
      "item": "vanilla"
     },
     {
      "qty": "2 cups",
      "item": "pecans, chopped"
     },
     {
      "qty": "4 cups",
      "item": "all-purpose flour"
     },
     {
      "qty": "1 tsp.",
      "item": "baking powder"
     },
     {
      "qty": "½ lb.",
      "item": "dates"
     },
     {
      "qty": "½ lb.",
      "item": "candied cherries"
     },
     {
      "qty": "½ lb.",
      "item": "white raisins"
     },
     {
      "qty": "3 slices",
      "item": "red and green candied pineapple, finely cut"
     },
     {
      "qty": "1 tsp.",
      "item": "cinnamon"
     },
     {
      "qty": "1 tsp.",
      "item": "baking soda"
     }
    ]
   }
  ],
  "steps": [
   "Sift together the flour, cinnamon, soda and baking powder.",
   "Cream together the butter, sugars, eggs and vanilla.",
   "Mix the cut-up fruit and pecans with the dry ingredients.",
   "Add the fruit mixture to the butter mixture.",
   "Shape into small rolls, wrap in wax paper and refrigerate overnight.",
   "Slice and bake at 325°F for 10–15 minutes."
  ],
  "tips": [
   "These freeze well."
  ],
  "ovenTemp": "325°F",
  "cookTime": "10–15 minutes",
  "yield": null,
  "editorNotes": [
   "White raisins are printed as \"1/2 white raisins\" with no unit; ½ lb. is a best guess, matching the other fruit.",
   "The method does not say where the pecans go; they are added with the fruit here."
  ]
 },
 {
  "id": "pecan-crunchies",
  "title": "Pecan Crunchies",
  "category": "Cookies & Bars",
  "book": "central",
  "contributor": "Mrs. R. O. Greever",
  "contributorRole": null,
  "city": "Logan",
  "state": "West Virginia",
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "½ cup",
      "item": "shortening"
     },
     {
      "qty": "½ cup",
      "item": "butter"
     },
     {
      "qty": "2½ cups",
      "item": "brown sugar, packed"
     },
     {
      "qty": "2",
      "item": "eggs, well beaten"
     },
     {
      "qty": "2½ cups",
      "item": "flour"
     },
     {
      "qty": "½ tsp.",
      "item": "salt"
     },
     {
      "qty": "½ tsp.",
      "item": "baking soda"
     },
     {
      "qty": "1 cup",
      "item": "chopped pecans"
     }
    ]
   }
  ],
  "steps": [
   "Cream the shortening and sugar. Add the eggs and beat well.",
   "Add the sifted dry ingredients and the nuts.",
   "Drop onto a greased cookie sheet.",
   "Bake at 350°F for 12–15 minutes."
  ],
  "tips": [],
  "ovenTemp": "350°F",
  "cookTime": "12–15 minutes",
  "yield": null,
  "editorNotes": [
   "The method mentions only shortening when creaming; the butter is presumably creamed with it."
  ]
 },
 {
  "id": "tea-time-tassies",
  "title": "Tea Time Tassies",
  "category": "Cookies & Bars",
  "book": "central",
  "contributor": "Mrs. John Milne",
  "contributorRole": null,
  "city": "Logan",
  "state": "West Virginia",
  "ingredientGroups": [
   {
    "name": "Cheese pastry",
    "items": [
     {
      "qty": "1 (3 oz.) pkg.",
      "item": "cream cheese"
     },
     {
      "qty": "½ cup",
      "item": "butter or oleo"
     },
     {
      "qty": "1 cup",
      "item": "sifted flour"
     }
    ]
   },
   {
    "name": "Pecan filling",
    "items": [
     {
      "qty": "1",
      "item": "egg"
     },
     {
      "qty": "¾ cup",
      "item": "brown sugar"
     },
     {
      "qty": "1 tsp.",
      "item": "sugar"
     },
     {
      "qty": "1 tsp.",
      "item": "soft butter"
     },
     {
      "qty": "1 tsp.",
      "item": "vanilla"
     },
     {
      "qty": "",
      "item": "dash of salt"
     },
     {
      "qty": "¾ cup",
      "item": "broken pecans"
     }
    ]
   }
  ],
  "steps": [
   "Pastry: Let the cream cheese and butter soften at room temperature. Blend, then stir in the flour.",
   "Chill about 1 hour.",
   "Shape into balls and place in tiny 1¾-inch muffin cups. Press the dough over the bottom and sides of each cup.",
   "Filling: Beat the egg, butter, vanilla, salt and brown sugar until smooth.",
   "Divide half the pecans among the cups. Add the egg mixture and top with the remaining pecans.",
   "Bake at 325°F for 25 minutes, or until the filling is set.",
   "Cool, then remove from the pans."
  ],
  "tips": [
   "Doubling the filling makes fuller cups."
  ],
  "ovenTemp": "325°F",
  "cookTime": "25 minutes",
  "yield": null,
  "editorNotes": [
   "\"1 tsp. sugar\" is listed but not used in the method; it may be a duplicate of the brown sugar.",
   "Butter for the filling is printed as \"1 tsp.\"; the similar Pecan Gems recipe uses 1 Tbsp., so this may be a misprint."
  ]
 },
 {
  "id": "spice-drop-cookies",
  "title": "Spice Drop Cookies",
  "category": "Cookies & Bars",
  "book": "central",
  "contributor": "Mrs. Clifford Hansen",
  "contributorRole": "Governor's Mansion",
  "city": "Cheyenne",
  "state": "Wyoming",
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "1 cup",
      "item": "butter"
     },
     {
      "qty": "1 cup",
      "item": "sugar"
     },
     {
      "qty": "½ cup",
      "item": "New Orleans molasses"
     },
     {
      "qty": "½ cup",
      "item": "sour milk"
     },
     {
      "qty": "3",
      "item": "eggs, beaten"
     },
     {
      "qty": "3 cups",
      "item": "flour"
     },
     {
      "qty": "1 tsp.",
      "item": "baking soda"
     },
     {
      "qty": "1 tsp.",
      "item": "cinnamon"
     },
     {
      "qty": "1 tsp.",
      "item": "cloves"
     },
     {
      "qty": "1 tsp.",
      "item": "nutmeg"
     },
     {
      "qty": "½ cup",
      "item": "chopped walnuts"
     },
     {
      "qty": "½ cup",
      "item": "raisins"
     }
    ]
   }
  ],
  "steps": [
   "Cream the butter and sugar. Add the eggs and molasses.",
   "Sift the flour with the soda and spices.",
   "Add the sour milk alternately with the flour mixture.",
   "Add the nuts and raisins last.",
   "Drop by teaspoonfuls onto a greased baking sheet.",
   "Bake at 350°F."
  ],
  "tips": [],
  "ovenTemp": "350°F",
  "cookTime": null,
  "yield": null,
  "editorNotes": [
   "No baking time is given.",
   "\"Sour milk\" is milk soured naturally or with a little vinegar or lemon juice; buttermilk is a common substitute."
  ]
 },
 {
  "id": "viennese-cranberry-cookies",
  "title": "Viennese Cranberry Cookies",
  "category": "Cookies & Bars",
  "book": "central",
  "contributor": "Mrs. Alma Perry",
  "contributorRole": null,
  "city": "Charleston",
  "state": "West Virginia",
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "3 cups",
      "item": "flour"
     },
     {
      "qty": "2 sticks",
      "item": "butter"
     },
     {
      "qty": "4 oz.",
      "item": "pecans, cut fine"
     },
     {
      "qty": "1 cup",
      "item": "sugar"
     },
     {
      "qty": "1",
      "item": "egg yolk"
     },
     {
      "qty": "1",
      "item": "whole egg"
     },
     {
      "qty": "1 tsp.",
      "item": "vanilla"
     }
    ]
   },
   {
    "name": "Filling",
    "items": [
     {
      "qty": "2 cups",
      "item": "whole cranberry sauce"
     }
    ]
   }
  ],
  "steps": [
   "Mix all the dough ingredients together and refrigerate for 24 hours.",
   "Set aside about ⅓ of the dough for the lattice.",
   "Roll the rest out very thin and place on a cookie sheet, crimping the edges a little to hold the filling.",
   "Fill with the cranberry sauce.",
   "Roll out the reserved dough and make a lattice across the top.",
   "Bake."
  ],
  "tips": [
   "These are very moist and keep for several weeks.",
   "Especially good at Christmas."
  ],
  "ovenTemp": null,
  "cookTime": null,
  "yield": null,
  "editorNotes": [
   "No oven temperature or baking time is given.",
   "This bakes as one sheet; the source does not say to cut it into bars, but that is how it would be served."
  ]
 },
 {
  "id": "alabama-lizzies",
  "title": "Alabama Lizzies",
  "category": "Cookies & Bars",
  "book": "central",
  "contributor": "Mrs. Ina McKinney",
  "contributorRole": null,
  "city": "Logan",
  "state": "West Virginia",
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "1 stick",
      "item": "butter"
     },
     {
      "qty": "1¼ cups",
      "item": "brown sugar"
     },
     {
      "qty": "4",
      "item": "eggs"
     },
     {
      "qty": "1 cup",
      "item": "whiskey"
     },
     {
      "qty": "3 tsp.",
      "item": "sweet milk"
     },
     {
      "qty": "4 cups",
      "item": "flour"
     },
     {
      "qty": "3 tsp.",
      "item": "baking soda"
     },
     {
      "qty": "1 tsp.",
      "item": "cinnamon"
     },
     {
      "qty": "1 tsp.",
      "item": "cloves"
     },
     {
      "qty": "1 tsp.",
      "item": "allspice"
     },
     {
      "qty": "1 tsp.",
      "item": "nutmeg"
     },
     {
      "qty": "2 lbs.",
      "item": "candied cherries"
     },
     {
      "qty": "2 lbs.",
      "item": "candied pineapple"
     },
     {
      "qty": "2 lbs.",
      "item": "raisins, white and dark"
     },
     {
      "qty": "6 cups",
      "item": "pecans, broken"
     }
    ]
   },
   {
    "name": "Also needed",
    "items": [
     {
      "qty": "½ cup",
      "item": "flour, for dredging the fruit (extra)"
     }
    ]
   }
  ],
  "steps": [
   "Cream the butter and sugar. Add the eggs one at a time.",
   "Add the whiskey and milk.",
   "Sift all the dry ingredients and add to the batter.",
   "Cut up the fruit and dredge it in the extra ½ cup of flour (not part of the 4 cups).",
   "Add the fruit and nuts to the batter.",
   "Drop by teaspoonfuls onto greased cookie sheets.",
   "Bake in a slow oven at 275°F for 12–15 minutes."
  ],
  "tips": [],
  "ovenTemp": "275°F",
  "cookTime": "12–15 minutes",
  "yield": "About 225–250 cookies",
  "editorNotes": [
   "Milk is printed as \"3 tsp\"; that is very little for this batter, and 3 Tbsp. may be meant.",
   "The source's wording about the dry ingredients and fruit is run together (\"Sift all dry ingredients and add to mixed fruit, cut up and mix or dredge\"); the steps follow the most likely reading."
  ]
 },
 {
  "id": "cranberry-nut-salad",
  "title": "Cranberry Nut Salad",
  "category": "Salads",
  "book": "centennial",
  "contributor": "Mrs. G. E. Justice",
  "contributorRole": null,
  "city": "Logan",
  "state": "West Virginia",
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "1 pkg.",
      "item": "lemon gelatin (Jell-O)"
     },
     {
      "qty": "1 pkg.",
      "item": "cherry gelatin (Jell-O)"
     },
     {
      "qty": "2 cups",
      "item": "hot water"
     },
     {
      "qty": "1 can",
      "item": "crushed pineapple"
     },
     {
      "qty": "1 cup",
      "item": "sugar"
     },
     {
      "qty": "1 cup",
      "item": "raw cranberries, ground"
     },
     {
      "qty": "1 cup",
      "item": "chopped celery"
     },
     {
      "qty": "1",
      "item": "orange, ground"
     },
     {
      "qty": "½ cup",
      "item": "chopped walnuts"
     }
    ]
   }
  ],
  "steps": [
   "Dissolve the gelatin in the hot water.",
   "Mix in the remaining ingredients.",
   "Chill until set."
  ],
  "tips": [],
  "ovenTemp": null,
  "cookTime": null,
  "yield": null,
  "editorNotes": [
   "The source says only \"Mix together and chill until like jello\"; dissolving the gelatin first is implied.",
   "Can size for the pineapple is not given."
  ]
 },
 {
  "id": "lime-salad",
  "title": "Lime Salad",
  "category": "Salads",
  "book": "centennial",
  "contributor": "Mrs. S. Ray Toothman",
  "contributorRole": null,
  "city": "Logan",
  "state": "West Virginia",
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "1 pkg.",
      "item": "lime gelatin (Jell-O)"
     },
     {
      "qty": "1 (3 oz.) pkg.",
      "item": "cream cheese"
     },
     {
      "qty": "⅓ cup",
      "item": "nuts, chopped"
     },
     {
      "qty": "1 scant Tbsp.",
      "item": "vinegar"
     },
     {
      "qty": "2 tsp.",
      "item": "salt"
     },
     {
      "qty": "1 cup",
      "item": "boiling water"
     },
     {
      "qty": "1⅓ cups",
      "item": "crushed pineapple"
     }
    ]
   }
  ],
  "steps": [
   "Cream the cream cheese and dry gelatin together until smooth.",
   "Add the boiling water and blend well.",
   "Add the remaining ingredients and mold as desired."
  ],
  "tips": [],
  "ovenTemp": null,
  "cookTime": null,
  "yield": null,
  "editorNotes": [
   "\"2 tsp. salt\" is a lot for a sweet gelatin salad; it may be a garbled ½ tsp."
  ]
 },
 {
  "id": "delicious-cranberry-salad",
  "title": "Delicious Cranberry Salad",
  "category": "Salads",
  "book": "centennial",
  "contributor": "Mrs. Aaron Dean",
  "contributorRole": null,
  "city": "Logan",
  "state": "West Virginia",
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "2 pkgs.",
      "item": "cherry gelatin (Jell-O)"
     },
     {
      "qty": "2 cups",
      "item": "hot water"
     },
     {
      "qty": "½ cup",
      "item": "cold water"
     },
     {
      "qty": "1 cup",
      "item": "pineapple juice"
     },
     {
      "qty": "1 cup",
      "item": "sugar"
     },
     {
      "qty": "1 Tbsp.",
      "item": "lemon juice"
     },
     {
      "qty": "1 cup",
      "item": "ground cranberries"
     },
     {
      "qty": "1",
      "item": "whole orange, ground"
     },
     {
      "qty": "1 cup",
      "item": "crushed pineapple"
     },
     {
      "qty": "1 cup",
      "item": "chopped celery"
     },
     {
      "qty": "½ cup",
      "item": "chopped nuts"
     }
    ]
   }
  ],
  "steps": [
   "Dissolve the gelatin in the hot water, then add the cold water.",
   "Add the pineapple juice, sugar and lemon juice. Mix well.",
   "Add the remaining ingredients in the order given.",
   "Chill until firm."
  ],
  "tips": [],
  "ovenTemp": null,
  "cookTime": null,
  "yield": null,
  "editorNotes": []
 },
 {
  "id": "my-circle-salad",
  "title": "My Circle Salad",
  "category": "Salads",
  "book": "centennial",
  "contributor": "Mrs. W. H. Honaker",
  "contributorRole": null,
  "city": "Logan",
  "state": "West Virginia",
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "1 large pkg.",
      "item": "lemon gelatin (Jell-O)"
     },
     {
      "qty": "1 large pkg.",
      "item": "lime gelatin (Jell-O)"
     },
     {
      "qty": "1 envelope",
      "item": "Knox unflavored gelatin"
     },
     {
      "qty": "2 cups",
      "item": "boiling water"
     },
     {
      "qty": "¾ cup",
      "item": "ice water"
     },
     {
      "qty": "1 (#2½) can",
      "item": "crushed pineapple"
     },
     {
      "qty": "1 cup",
      "item": "Carnation evaporated milk"
     },
     {
      "qty": "1 cup",
      "item": "mayonnaise"
     },
     {
      "qty": "1 cup",
      "item": "chopped nuts"
     },
     {
      "qty": "1 lb. jar",
      "item": "cottage cheese"
     }
    ]
   }
  ],
  "steps": [
   "Dissolve the gelatin in the boiling water, then add the ice water.",
   "Chill, but do not let the mixture set.",
   "Stir the remaining ingredients together, then add them to the chilled gelatin.",
   "Chill until firm."
  ],
  "tips": [],
  "ovenTemp": null,
  "cookTime": null,
  "yield": "About 16 servings",
  "editorNotes": [
   "Mayonnaise is printed as \"| Cup\"; 1 cup is a best guess.",
   "The source says \"Add rest of ingredients. Stir then add to chilled jello,\" which is contradictory; the steps follow the most likely reading.",
   "A #2½ can holds about 3½ cups (28–29 oz.)."
  ]
 },
 {
  "id": "banana-bread",
  "title": "Banana Bread",
  "category": "Breads",
  "book": "centennial",
  "contributor": "Mrs. A. B. Hardman",
  "contributorRole": null,
  "city": "Logan",
  "state": "West Virginia",
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "1 cup",
      "item": "sifted flour"
     },
     {
      "qty": "¼ tsp.",
      "item": "baking powder"
     },
     {
      "qty": "¼ tsp.",
      "item": "salt"
     },
     {
      "qty": "1 cup",
      "item": "nonfat dry milk"
     },
     {
      "qty": "⅓ cup",
      "item": "shortening"
     },
     {
      "qty": "1 cup",
      "item": "sugar"
     },
     {
      "qty": "1",
      "item": "egg, unbeaten"
     },
     {
      "qty": "2 cups",
      "item": "mashed bananas"
     },
     {
      "qty": "½ cup",
      "item": "nuts (optional)"
     }
    ]
   }
  ],
  "steps": [
   "Sift together the flour, baking powder, salt and dry milk. Set aside.",
   "Blend the shortening and sugar. Add the egg and beat hard.",
   "Stir in about half the flour mixture, then the bananas.",
   "Add the rest of the flour mixture and mix well.",
   "Spread the batter evenly in a greased 8-inch square pan.",
   "Bake at 350°F for 35 minutes.",
   "Ice with butter icing."
  ],
  "tips": [],
  "ovenTemp": "350°F",
  "cookTime": "35 minutes",
  "yield": null,
  "editorNotes": [
   "No recipe for the butter icing is given.",
   "The nuts are listed but the method does not say when to add them; fold them in with the last of the flour.",
   "¼ tsp. baking powder is very little leavening for this batter; it may be a misprint."
  ]
 },
 {
  "id": "fruit-bread",
  "title": "Fruit Bread",
  "category": "Breads",
  "book": "centennial",
  "contributor": "Mrs. Vernon M. Hefner",
  "contributorRole": null,
  "city": "Logan",
  "state": "West Virginia",
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "3 cups",
      "item": "flour"
     },
     {
      "qty": "½ tsp.",
      "item": "salt"
     },
     {
      "qty": "4 tsp.",
      "item": "baking powder"
     },
     {
      "qty": "½ tsp.",
      "item": "baking soda"
     },
     {
      "qty": "¼ cup",
      "item": "molasses"
     },
     {
      "qty": "1 cup",
      "item": "milk"
     },
     {
      "qty": "1",
      "item": "egg, lightly beaten"
     },
     {
      "qty": "1 cup",
      "item": "dates or raisins"
     },
     {
      "qty": "½ cup",
      "item": "chopped nuts"
     }
    ]
   }
  ],
  "steps": [
   "Sift the flour, baking powder and salt together.",
   "Dissolve the soda in the molasses and add to the flour.",
   "Add the milk and egg and beat smooth.",
   "Dust the nuts and fruit with flour and stir them in.",
   "Turn into a greased loaf pan and let rise 15 minutes.",
   "Bake at 325°F for about 1 hour."
  ],
  "tips": [],
  "ovenTemp": "325°F",
  "cookTime": "About 1 hour",
  "yield": null,
  "editorNotes": [
   "Salt is printed as \"12 Tsp.\", almost certainly a garbled ½ tsp.; ½ tsp. is a best guess.",
   "Milk is printed as \"4 Cups\", far too much for 3 cups of flour; 1 cup is a best guess."
  ]
 },
 {
  "id": "jewell-s-cake",
  "title": "Jewell's Cake",
  "category": "Cakes",
  "book": "centennial",
  "contributor": "Mrs. S. J. Maynard",
  "contributorRole": null,
  "city": "Logan",
  "state": "West Virginia",
  "ingredientGroups": [
   {
    "name": "Cake",
    "items": [
     {
      "qty": "¾ cup",
      "item": "shortening"
     },
     {
      "qty": "1½ cups",
      "item": "sugar"
     },
     {
      "qty": "3",
      "item": "eggs"
     },
     {
      "qty": "1¾ cups",
      "item": "flour"
     },
     {
      "qty": "½ tsp.",
      "item": "baking powder"
     },
     {
      "qty": "½ tsp.",
      "item": "baking soda"
     },
     {
      "qty": "½ tsp.",
      "item": "salt"
     },
     {
      "qty": "¾ tsp.",
      "item": "nutmeg"
     },
     {
      "qty": "1 tsp.",
      "item": "cinnamon"
     },
     {
      "qty": "1 Tbsp.",
      "item": "vanilla"
     },
     {
      "qty": "1 tsp.",
      "item": "lemon extract"
     },
     {
      "qty": "½ cup",
      "item": "chopped nuts"
     }
    ]
   },
   {
    "name": "Also needed",
    "items": [
     {
      "qty": "",
      "item": "buttermilk (amount not given)"
     },
     {
      "qty": "",
      "item": "cocoa (amount not given)"
     }
    ]
   },
   {
    "name": "Icing",
    "items": [
     {
      "qty": "6 Tbsp.",
      "item": "butter"
     },
     {
      "qty": "1",
      "item": "egg yolk"
     },
     {
      "qty": "3 cups",
      "item": "confectioners' sugar"
     },
     {
      "qty": "1 tsp.",
      "item": "cinnamon"
     },
     {
      "qty": "1½ Tbsp.",
      "item": "cocoa"
     },
     {
      "qty": "1½ Tbsp.",
      "item": "hot coffee, with 1 tsp. butter added"
     }
    ]
   }
  ],
  "steps": [
   "Put the shortening, sugar and eggs in a large mixing bowl.",
   "Sift the flour with the baking powder, spices, salt and cocoa.",
   "Add the soda and flavorings to the buttermilk.",
   "Sift the flour mixture into the mixing bowl and add about ½ cup of the buttermilk.",
   "Mix at medium speed until smooth, no more than 1 minute.",
   "Add the rest of the buttermilk and beat about 1 minute more.",
   "Mix the floured nuts in by hand.",
   "Bake in 2 layer cake pans at about 350°F.",
   "Icing: Cream the butter and blend in the egg yolk.",
   "Sift the sugar, cocoa and cinnamon together.",
   "Add the sugar mixture to the creamed butter alternately with the hot coffee. Beat until smooth."
  ],
  "tips": [],
  "ovenTemp": "350°F",
  "cookTime": null,
  "yield": "2 layers",
  "editorNotes": [
   "The method calls for buttermilk and cocoa, but neither is in the ingredient list or given an amount.",
   "The source says \"add the other egg with the rest of the milk\", suggesting the eggs were meant to go in at two stages; the list gives 3 eggs all at once.",
   "The source's method is garbled in places (\"Sift flo again\", \"Mix flou ed nuts\"); the steps follow the most likely reading.",
   "No baking time is given."
  ]
 },
 {
  "id": "christmas-fruit-cake",
  "title": "Christmas Fruit Cake",
  "category": "Cakes",
  "book": "centennial",
  "contributor": "Gertrude Wheeler",
  "contributorRole": null,
  "city": "Logan",
  "state": "West Virginia",
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "1 lb.",
      "item": "butter"
     },
     {
      "qty": "2 lbs.",
      "item": "sugar"
     },
     {
      "qty": "2 lbs.",
      "item": "flour"
     },
     {
      "qty": "12",
      "item": "egg yolks"
     },
     {
      "qty": "12",
      "item": "egg whites"
     },
     {
      "qty": "4 tsp.",
      "item": "baking powder"
     },
     {
      "qty": "1 Tbsp.",
      "item": "cinnamon"
     },
     {
      "qty": "1 Tbsp.",
      "item": "nutmeg"
     },
     {
      "qty": "1 Tbsp.",
      "item": "cloves"
     },
     {
      "qty": "¼ Tbsp.",
      "item": "allspice"
     },
     {
      "qty": "¼ Tbsp.",
      "item": "mace"
     },
     {
      "qty": "½ tsp.",
      "item": "salt"
     },
     {
      "qty": "2 lbs.",
      "item": "raisins"
     },
     {
      "qty": "2 lbs.",
      "item": "currants"
     },
     {
      "qty": "1 lb.",
      "item": "figs"
     },
     {
      "qty": "1 lb.",
      "item": "dates"
     },
     {
      "qty": "½ lb.",
      "item": "citron"
     },
     {
      "qty": "1 lb.",
      "item": "candied cherries"
     },
     {
      "qty": "1 lb.",
      "item": "candied pineapple"
     },
     {
      "qty": "1 lb.",
      "item": "pecans, ground"
     },
     {
      "qty": "1 lb.",
      "item": "blanched almonds"
     },
     {
      "qty": "1 glass",
      "item": "grape jelly"
     },
     {
      "qty": "1 cup",
      "item": "grape juice"
     },
     {
      "qty": "2 cups",
      "item": "orange juice"
     },
     {
      "qty": "½ cup",
      "item": "orange juice"
     },
     {
      "qty": "½ cup",
      "item": "lemon juice"
     }
    ]
   },
   {
    "name": "Also needed",
    "items": [
     {
      "qty": "",
      "item": "candied lemon and orange peel (amounts not given)"
     }
    ]
   }
  ],
  "steps": [
   "Cream the butter and sugar together. Add the beaten egg yolks.",
   "Dredge the raisins and currants well in flour, using at least 1 cup of the sifted flour, and add them.",
   "Add the figs, dates, citron, cherries, pineapple, and lemon and orange peel. Cut all the fruit fine.",
   "Put the pecans through a food chopper.",
   "Combine all the fruit and stir in the grape and orange juices.",
   "Add part of the beaten egg whites, the baking powder and the remaining flour. Beat well and mix thoroughly.",
   "Fold in the rest of the beaten egg whites.",
   "Bake in well-greased and buttered tube pans at 300°F (preheated) for 4 hours."
  ],
  "tips": [
   "The original cook set the pans on a heat shield to keep the cake from baking too fast."
  ],
  "ovenTemp": "300°F",
  "cookTime": "4 hours",
  "yield": "2 large cakes",
  "editorNotes": [
   "The source says to put \"asbestos plates\" under the cake. Do not use asbestos; a baking stone, a second sheet pan or a pan of water on the rack below does the same job.",
   "The portion of egg whites added first is printed as \"≥\", a garbled fraction (probably ½).",
   "The grape jelly, lemon juice, spices and almonds are listed but the method never says when to add them.",
   "Orange juice is listed twice (2 cups and ½ cup); one may be a duplicate.",
   "Lemon and orange peel are in the method but not the ingredient list.",
   "Allspice and mace are printed as \"¼ Tbsp.\", an unusual measure (about ¾ tsp.)."
  ]
 },
 {
  "id": "gum-drop-cake",
  "title": "Gum Drop Cake",
  "category": "Cakes",
  "book": "centennial",
  "contributor": "Mrs. C. R. Keeney",
  "contributorRole": null,
  "city": "Logan",
  "state": "West Virginia",
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "4 cups",
      "item": "sifted flour"
     },
     {
      "qty": "1 Tbsp.",
      "item": "baking powder"
     },
     {
      "qty": "1 tsp.",
      "item": "cinnamon"
     },
     {
      "qty": "¼ tsp.",
      "item": "cloves"
     },
     {
      "qty": "¼ tsp.",
      "item": "salt"
     },
     {
      "qty": "1 lb.",
      "item": "raisins"
     },
     {
      "qty": "2 cups",
      "item": "sugar"
     },
     {
      "qty": "1 cup",
      "item": "butter or oleo"
     },
     {
      "qty": "2",
      "item": "eggs"
     },
     {
      "qty": "1½ cups",
      "item": "applesauce"
     },
     {
      "qty": "1 tsp.",
      "item": "vanilla"
     },
     {
      "qty": "1 cup",
      "item": "chopped nuts"
     },
     {
      "qty": "1 lb.",
      "item": "small gumdrops (no black ones)"
     }
    ]
   }
  ],
  "steps": [
   "Put the gumdrops, nuts and raisins in a large pan, add a little flour and blend well.",
   "Sift together the flour, baking powder, spices and salt.",
   "Cream the butter and sugar. Add the eggs one at a time.",
   "Add the flour mixture and applesauce alternately.",
   "Add the batter to the candy mixture.",
   "Line a tube cake pan with brown paper.",
   "Bake at 275°F for 2 hours."
  ],
  "tips": [],
  "ovenTemp": "275°F",
  "cookTime": "2 hours",
  "yield": null,
  "editorNotes": [
   "Nuts are printed as \"1 chopped nuts\" with no unit; 1 cup is a best guess.",
   "\"Flue cake pan\" is read as a tube (flue) pan.",
   "Vanilla is listed but not mentioned in the method."
  ]
 },
 {
  "id": "hugo-tarte",
  "title": "Hugo Tarte",
  "category": "Desserts",
  "book": "centennial",
  "contributor": "Mrs. William Guy Wilson",
  "contributorRole": null,
  "city": "Logan",
  "state": "West Virginia",
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "4",
      "item": "eggs"
     },
     {
      "qty": "3 cups",
      "item": "sugar"
     },
     {
      "qty": "8 Tbsp.",
      "item": "flour"
     },
     {
      "qty": "½ tsp.",
      "item": "salt"
     },
     {
      "qty": "5 tsp.",
      "item": "baking powder"
     },
     {
      "qty": "2 cups",
      "item": "apples, cut fine"
     },
     {
      "qty": "2 cups",
      "item": "nuts, cut fine"
     },
     {
      "qty": "2 tsp.",
      "item": "vanilla"
     }
    ]
   }
  ],
  "steps": [
   "Beat the eggs until fluffy.",
   "Sift together the sugar, flour, baking powder and salt, and mix into the eggs.",
   "Add the apples, nuts and vanilla and mix together.",
   "Pour into 2 greased 7×11-inch pans.",
   "Bake at 350°F for 45 minutes.",
   "Cut in squares and serve with whipped cream."
  ],
  "tips": [
   "Serve with whipped cream."
  ],
  "ovenTemp": "350°F",
  "cookTime": "45 minutes",
  "yield": "Serves 16",
  "editorNotes": [
   "\"Sugar\" is listed among the sifted dry ingredients in the source; sifting it with the flour is unusual but follows the original."
  ]
 },
 {
  "id": "pecan-gems",
  "title": "Pecan Gems",
  "category": "Cookies & Bars",
  "book": "centennial",
  "contributor": "Mrs. Lance Lucas",
  "contributorRole": null,
  "city": "Logan",
  "state": "West Virginia",
  "ingredientGroups": [
   {
    "name": "Crust",
    "items": [
     {
      "qty": "1 (3 oz.) pkg.",
      "item": "cream cheese"
     },
     {
      "qty": "¼ lb.",
      "item": "butter or margarine"
     },
     {
      "qty": "1 cup",
      "item": "flour"
     }
    ]
   },
   {
    "name": "Filling",
    "items": [
     {
      "qty": "1",
      "item": "egg"
     },
     {
      "qty": "¾ cup",
      "item": "dark brown sugar"
     },
     {
      "qty": "1 Tbsp.",
      "item": "soft butter"
     },
     {
      "qty": "1 tsp.",
      "item": "vanilla"
     },
     {
      "qty": "⅔ cup",
      "item": "broken pecans"
     }
    ]
   }
  ],
  "steps": [
   "Crust: Cream the butter and cream cheese, both at room temperature. Blend in the flour.",
   "Chill about 1 hour.",
   "Shape into 24 balls and place in tiny muffin tins. Press the dough over the bottom and sides of the cups.",
   "Filling: Beat together the egg, sugar, butter and vanilla until smooth.",
   "Divide half the pecans among the pastry-lined cups.",
   "Add the egg mixture and top with the remaining pecans.",
   "Bake at 325°F for 25 minutes, or until the filling is set.",
   "Cool and remove from the pans."
  ],
  "tips": [],
  "ovenTemp": "325°F",
  "cookTime": "25 minutes",
  "yield": "24 tarts",
  "editorNotes": [
   "\"Until Snot\" in the source is read as \"until smooth\".",
   "The egg is printed as \"Egg\" with no number; 1 egg is a best guess."
  ]
 },
 {
  "id": "date-and-nut-bars",
  "title": "Date and Nut Bars",
  "category": "Cookies & Bars",
  "book": "centennial",
  "contributor": "Mrs. John P. Kaufman",
  "contributorRole": "President, State Federation",
  "city": "Baltimore",
  "state": "Maryland",
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "1 cup",
      "item": "granulated sugar"
     },
     {
      "qty": "4",
      "item": "eggs, separated"
     },
     {
      "qty": "1 tsp.",
      "item": "vanilla"
     },
     {
      "qty": "1 cup",
      "item": "flour"
     },
     {
      "qty": "2 tsp.",
      "item": "salt"
     },
     {
      "qty": "2 tsp.",
      "item": "baking powder"
     },
     {
      "qty": "2 lbs.",
      "item": "dates, chopped"
     },
     {
      "qty": "1 lb.",
      "item": "English walnuts, chopped"
     }
    ]
   },
   {
    "name": "Also needed",
    "items": [
     {
      "qty": "",
      "item": "sugar, for rolling"
     }
    ]
   }
  ],
  "steps": [
   "Mix the sugar, egg yolks and vanilla well.",
   "Sift the flour, salt and baking powder over the mixture.",
   "Add the dates and nuts.",
   "Fold in the well-beaten egg whites.",
   "Pour into greased and floured cake pans.",
   "Bake in a moderate oven at 325°F for 30–35 minutes.",
   "When baked, cut into bars and roll in sugar."
  ],
  "tips": [],
  "ovenTemp": "325°F",
  "cookTime": "30–35 minutes",
  "yield": null,
  "editorNotes": [
   "The title is cut off in the source (\"AND NUT BARS\"); \"Date and Nut Bars\" is a best guess from the ingredients.",
   "\"2 tsp. salt\" is high for this amount of flour; it may be a garbled ½ tsp."
  ]
 },
 {
  "id": "lemon-squares",
  "title": "Lemon Squares",
  "category": "Cookies & Bars",
  "book": "centennial",
  "contributor": "Mrs. Frank White",
  "contributorRole": null,
  "city": "Logan",
  "state": "West Virginia",
  "ingredientGroups": [
   {
    "name": "Crust",
    "items": [
     {
      "qty": "1½ cups",
      "item": "flour"
     },
     {
      "qty": "½ cup",
      "item": "brown sugar"
     },
     {
      "qty": "½ cup",
      "item": "butter"
     }
    ]
   },
   {
    "name": "Topping",
    "items": [
     {
      "qty": "2",
      "item": "eggs"
     },
     {
      "qty": "1 cup",
      "item": "brown sugar"
     },
     {
      "qty": "1½ cups",
      "item": "coconut"
     },
     {
      "qty": "1 cup",
      "item": "pecans"
     },
     {
      "qty": "1 Tbsp.",
      "item": "flour"
     },
     {
      "qty": "½ tsp.",
      "item": "baking powder"
     },
     {
      "qty": "¼ tsp.",
      "item": "salt"
     },
     {
      "qty": "½ tsp.",
      "item": "vanilla"
     }
    ]
   },
   {
    "name": "Lemon frosting",
    "items": [
     {
      "qty": "1 Tbsp.",
      "item": "melted butter"
     },
     {
      "qty": "1 cup",
      "item": "confectioners' sugar"
     },
     {
      "qty": "1",
      "item": "lemon, juiced"
     }
    ]
   }
  ],
  "steps": [
   "Crust: Mix the flour, brown sugar and butter. Press into a pan and bake at 275°F for 10 minutes.",
   "Topping: Mix the eggs, brown sugar, coconut, pecans, flour, baking powder, salt and vanilla.",
   "Spread the topping over the crust and bake at 350°F for 20 minutes.",
   "Frosting: Stir together the melted butter, confectioners' sugar and lemon juice.",
   "Spread the frosting over the squares while warm, then cut into squares while still warm."
  ],
  "tips": [],
  "ovenTemp": "350°F",
  "cookTime": "30 minutes total",
  "yield": null,
  "editorNotes": [
   "Brown sugar for the crust is printed as \"1/2 brown sugar\" with no unit; ½ cup is a best guess.",
   "The crust temperature is printed as 275°F; 375°F may have been meant.",
   "Pan size is not given."
  ]
 },
 {
  "id": "bourbon-balls",
  "title": "Bourbon Balls",
  "category": "Candies",
  "book": "centennial",
  "contributor": "Mrs. T. L. Henritze",
  "contributorRole": null,
  "city": "Logan",
  "state": "West Virginia",
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "1 cup",
      "item": "vanilla wafer crumbs"
     },
     {
      "qty": "1 cup",
      "item": "chopped pecans"
     },
     {
      "qty": "1 cup",
      "item": "powdered sugar, plus more for rolling"
     },
     {
      "qty": "2 Tbsp.",
      "item": "cocoa"
     },
     {
      "qty": "2 jiggers",
      "item": "bourbon whiskey"
     },
     {
      "qty": "1½ Tbsp.",
      "item": "white corn syrup"
     }
    ]
   }
  ],
  "steps": [
   "Combine the crumbs, pecans, sugar and cocoa.",
   "Mix the whiskey and corn syrup together.",
   "Stir the whiskey mixture into the crumb mixture.",
   "Form into small balls and roll in powdered sugar.",
   "Keep cool until ready to serve."
  ],
  "tips": [
   "Keep cool until ready to serve."
  ],
  "ovenTemp": null,
  "cookTime": null,
  "yield": null,
  "editorNotes": [
   "A jigger is 1½ fl. oz., so 2 jiggers is about 3 fl. oz. (6 Tbsp.)."
  ]
 },
 {
  "id": "go-to-school-cookies",
  "title": "Go-to-School Cookies",
  "category": "Cookies & Bars",
  "book": "centennial",
  "contributor": "Mrs. Alex Defobio",
  "contributorRole": null,
  "city": "Logan",
  "state": "West Virginia",
  "ingredientGroups": [
   {
    "name": "Cookies",
    "items": [
     {
      "qty": "1 cup",
      "item": "brown sugar"
     },
     {
      "qty": "½ cup",
      "item": "Crisco shortening"
     },
     {
      "qty": "2 squares",
      "item": "chocolate, melted"
     },
     {
      "qty": "1",
      "item": "egg, slightly beaten"
     },
     {
      "qty": "½ cup",
      "item": "milk"
     },
     {
      "qty": "1½ cups",
      "item": "flour"
     },
     {
      "qty": "¼ tsp.",
      "item": "baking soda"
     },
     {
      "qty": "½ tsp.",
      "item": "salt"
     },
     {
      "qty": "½ tsp.",
      "item": "baking powder"
     },
     {
      "qty": "¼ cup",
      "item": "chopped nutmeats"
     },
     {
      "qty": "½ tsp.",
      "item": "vanilla"
     }
    ]
   },
   {
    "name": "Icing",
    "items": [
     {
      "qty": "¼ cup",
      "item": "Crisco shortening"
     },
     {
      "qty": "2 cups",
      "item": "confectioners' sugar"
     },
     {
      "qty": "4 Tbsp.",
      "item": "hot water, plus 1 Tbsp. more"
     },
     {
      "qty": "¼ tsp.",
      "item": "salt"
     },
     {
      "qty": "½ tsp.",
      "item": "vanilla"
     },
     {
      "qty": "1 square",
      "item": "chocolate, melted"
     },
     {
      "qty": "",
      "item": "nutmeats, for topping"
     }
    ]
   }
  ],
  "steps": [
   "Mix the sugar with the Crisco.",
   "Add the melted chocolate, egg and milk.",
   "Stir in the sifted dry ingredients, then the nutmeats and vanilla.",
   "Drop by teaspoonfuls onto a greased cookie sheet.",
   "Bake in a moderate oven at 350°F for 12–15 minutes.",
   "Icing: Beat the confectioners' sugar into the Crisco alternately with 4 Tbsp. hot water. Add the salt and vanilla.",
   "Move ⅓ of the icing to a separate bowl and add the melted chocolate and 1 Tbsp. hot water.",
   "Spread the cookies with the white icing. Put a dab of chocolate icing in the center of each and top with a nutmeat."
  ],
  "tips": [],
  "ovenTemp": "350°F",
  "cookTime": "12–15 minutes",
  "yield": null,
  "editorNotes": [
   "\"Squares\" of chocolate means 1-oz. squares of unsweetened baking chocolate."
  ]
 },
 {
  "id": "jubilee-jumbles",
  "title": "Jubilee Jumbles",
  "category": "Cookies & Bars",
  "book": "centennial",
  "contributor": "Mrs. W. A. Brown",
  "contributorRole": null,
  "city": "Logan",
  "state": "West Virginia",
  "ingredientGroups": [
   {
    "name": "Cookies",
    "items": [
     {
      "qty": "½ cup",
      "item": "soft shortening"
     },
     {
      "qty": "1 cup",
      "item": "brown sugar, packed"
     },
     {
      "qty": "½ cup",
      "item": "granulated sugar"
     },
     {
      "qty": "2",
      "item": "eggs"
     },
     {
      "qty": "1 cup",
      "item": "evaporated milk"
     },
     {
      "qty": "1 tsp.",
      "item": "vanilla"
     },
     {
      "qty": "2¾ cups",
      "item": "sifted flour"
     },
     {
      "qty": "½ tsp.",
      "item": "baking soda"
     },
     {
      "qty": "1 tsp.",
      "item": "salt"
     },
     {
      "qty": "1 cup",
      "item": "cut-up walnuts, coconut, dates, raisins or semisweet chocolate"
     }
    ]
   },
   {
    "name": "Browned butter glaze",
    "items": [
     {
      "qty": "2 Tbsp.",
      "item": "butter"
     },
     {
      "qty": "2 cups",
      "item": "sifted confectioners' sugar"
     },
     {
      "qty": "½ cup",
      "item": "evaporated milk, diluted"
     },
     {
      "qty": "",
      "item": "nuts, coconut or maraschino cherry halves, for topping"
     }
    ]
   }
  ],
  "steps": [
   "Mix the shortening, sugars and eggs thoroughly.",
   "Stir in the milk and vanilla.",
   "Sift together the flour, soda and salt and stir in.",
   "Blend in the walnuts (or other add-in).",
   "Chill 1 hour. Heat the oven to 375°F.",
   "Drop by rounded tablespoons 2 inches apart on a greased baking sheet.",
   "Bake about 10 minutes.",
   "Glaze: Heat the butter until golden brown. Beat in the confectioners' sugar and diluted milk until smooth.",
   "Spread on the cookies and top with nuts, coconut or half a maraschino cherry."
  ],
  "tips": [],
  "ovenTemp": "375°F",
  "cookTime": "About 10 minutes",
  "yield": null,
  "editorNotes": [
   "\"Diluted\" evaporated milk is not explained; it usually means mixed half and half with water."
  ]
 },
 {
  "id": "candy-pudding",
  "title": "Candy Pudding",
  "category": "Candies",
  "book": "centennial",
  "contributor": "Mrs. John Scott Albright",
  "contributorRole": null,
  "city": "Montgomery",
  "state": "Alabama",
  "ingredientGroups": [
   {
    "name": "Candy",
    "items": [
     {
      "qty": "3 cups",
      "item": "granulated sugar"
     },
     {
      "qty": "1 cup",
      "item": "water"
     },
     {
      "qty": "4 Tbsp.",
      "item": "vinegar"
     },
     {
      "qty": "2 tsp.",
      "item": "butter"
     },
     {
      "qty": "1 tsp.",
      "item": "salt"
     },
     {
      "qty": "",
      "item": "small lump of baking soda"
     }
    ]
   },
   {
    "name": "Fruit and nuts",
    "items": [
     {
      "qty": "1",
      "item": "coconut, grated"
     },
     {
      "qty": "½ lb.",
      "item": "raisins, chopped"
     },
     {
      "qty": "½ lb.",
      "item": "almonds, chopped"
     },
     {
      "qty": "½ lb.",
      "item": "figs, chopped"
     },
     {
      "qty": "½ lb.",
      "item": "pecans, chopped"
     }
    ]
   },
   {
    "name": "Also needed",
    "items": [
     {
      "qty": "",
      "item": "cinnamon, for rolling"
     }
    ]
   }
  ],
  "steps": [
   "Mix the candy ingredients and set over a slow fire for a short while.",
   "Raise the heat and cook quickly until a drop forms a brittle ball in cold water.",
   "Pour onto a cookie sheet and let cool.",
   "Pull the candy until light.",
   "Work in the coconut, raisins, almonds, figs and pecans.",
   "Roll into oblong rolls and roll them in cinnamon.",
   "Wrap in a damp cloth and slice when set."
  ],
  "tips": [
   "Keeps for a long time."
  ],
  "ovenTemp": null,
  "cookTime": null,
  "yield": null,
  "editorNotes": [
   "The pecan line is split and garbled in the source (\"1/2 Lb. chopped / 1/2 pecans\"); read as ½ lb. chopped pecans.",
   "\"Lump of soda\" gives no amount; a pinch of baking soda is the usual reading.",
   "A brittle ball in cold water is the hard-crack stage, about 300°F on a candy thermometer."
  ]
 },
 {
  "id": "easy-chocolate-nut-candy",
  "title": "Easy Chocolate Nut Candy",
  "category": "Candies",
  "book": "centennial",
  "contributor": "Mrs. B. Shell",
  "contributorRole": null,
  "city": "Logan",
  "state": "West Virginia",
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "1 (6 oz.) pkg.",
      "item": "chocolate chips"
     },
     {
      "qty": "1 cup",
      "item": "nutmeats, broken"
     },
     {
      "qty": "3 Tbsp.",
      "item": "evaporated milk"
     },
     {
      "qty": "½ tsp.",
      "item": "vanilla"
     },
     {
      "qty": "6 Tbsp.",
      "item": "confectioners' sugar"
     },
     {
      "qty": "Pinch",
      "item": "salt"
     }
    ]
   }
  ],
  "steps": [
   "Melt chocolate with milk in a double boiler; remove from heat.",
   "Add confectioners' sugar, nuts, vanilla and salt.",
   "Drop by teaspoons onto waxed paper."
  ],
  "tips": [],
  "ovenTemp": null,
  "cookTime": null,
  "yield": "About 3 dozen pieces",
  "editorNotes": []
 },
 {
  "id": "spiced-walnuts-and-pecans",
  "title": "Spiced Walnuts and Pecans",
  "category": "Candies",
  "book": "centennial",
  "contributor": "Mrs. Howard Shelton",
  "contributorRole": null,
  "city": "Logan",
  "state": "West Virginia",
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "1",
      "item": "egg white, slightly beaten"
     },
     {
      "qty": "2 Tbsp.",
      "item": "cold water"
     },
     {
      "qty": "½ cup",
      "item": "sugar"
     },
     {
      "qty": "¼ tsp.",
      "item": "cinnamon"
     },
     {
      "qty": "¼ tsp.",
      "item": "cloves"
     },
     {
      "qty": "¼ tsp.",
      "item": "allspice"
     },
     {
      "qty": "½ tsp.",
      "item": "salt"
     },
     {
      "qty": "",
      "item": "walnuts and pecans"
     }
    ]
   }
  ],
  "steps": [
   "Add water to slightly beaten egg white.",
   "Dissolve sugar in the egg white mixture; add spices and salt and mix well.",
   "Dip nuts in the mixture and place on a greased cookie sheet.",
   "Bake 1 hour at 250°F, or until golden."
  ],
  "tips": [],
  "ovenTemp": "250°F",
  "cookTime": "1 hour",
  "yield": null,
  "editorNotes": [
   "No quantity is given for the walnuts and pecans."
  ]
 },
 {
  "id": "chocolate-logs",
  "title": "Chocolate Logs",
  "category": "Candies",
  "book": "centennial",
  "contributor": "Linda Williamson",
  "contributorRole": null,
  "city": "Logan",
  "state": "West Virginia",
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "2 (6 oz.) pkgs.",
      "item": "chocolate bits"
     },
     {
      "qty": "⅔ cup",
      "item": "evaporated milk"
     },
     {
      "qty": "1 tsp.",
      "item": "vanilla"
     },
     {
      "qty": "4½ cups",
      "item": "sifted powdered sugar"
     },
     {
      "qty": "1 cup",
      "item": "finely cut nuts"
     }
    ]
   },
   {
    "name": "Also needed",
    "items": [
     {
      "qty": "",
      "item": "coconut (optional, for rolling)"
     }
    ]
   }
  ],
  "steps": [
   "Pour chocolate bits and milk into a 3-quart saucepan.",
   "Stir over low heat until the chocolate melts completely; remove from heat.",
   "Add vanilla, then add sugar one cup at a time.",
   "Chill the mixture until firm enough to shape, about 1 hour.",
   "Put half of the chilled mixture between sheets of waxed paper and shape into a log about 10 inches long. Repeat with the rest.",
   "Roll logs in nuts or coconut until coated.",
   "Wrap in waxed paper and chill.",
   "With a sharp knife, slice each log into about 24 pieces."
  ],
  "tips": [],
  "ovenTemp": null,
  "cookTime": null,
  "yield": "Two 10-inch logs (about 48 slices)",
  "editorNotes": [
   "Source reads \"2 boz. pkgs.\" — taken as 2 (6 oz.) packages (best guess).",
   "Source text is garbled at the chilling step (\"ture until firm enough to shape about 1 hour\"); read as chilling the mixture.",
   "Coconut appears in the method but not the ingredient list."
  ]
 },
 {
  "id": "black-walnut-fudge",
  "title": "Black Walnut Fudge",
  "category": "Candies",
  "book": "centennial",
  "contributor": "Mrs. T. E. Browning",
  "contributorRole": null,
  "city": "Huntington",
  "state": "West Virginia",
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "2 cups",
      "item": "sugar"
     },
     {
      "qty": "1 cup",
      "item": "water"
     },
     {
      "qty": "Pinch",
      "item": "cream of tartar"
     },
     {
      "qty": "",
      "item": "black walnuts"
     }
    ]
   }
  ],
  "steps": [
   "Cook sugar, water and cream of tartar until the syrup threads.",
   "Pour onto a marble slab and knead."
  ],
  "tips": [],
  "ovenTemp": null,
  "cookTime": null,
  "yield": null,
  "editorNotes": [
   "No quantity is given for the black walnuts, and the method does not say when to add them.",
   "\"Until it threads\" refers to the thread stage of sugar syrup; no temperature is given."
  ]
 },
 {
  "id": "weekend-candy",
  "title": "Weekend Candy",
  "category": "Candies",
  "book": "centennial",
  "contributor": "Mrs. Joseph Eros",
  "contributorRole": null,
  "city": "Anniston",
  "state": "Alabama",
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "3 cups",
      "item": "sugar"
     },
     {
      "qty": "1½ cups",
      "item": "coffee cream"
     },
     {
      "qty": "1 cup",
      "item": "white syrup"
     },
     {
      "qty": "1½ tsp.",
      "item": "vanilla"
     },
     {
      "qty": "½ lb.",
      "item": "candied pineapple"
     },
     {
      "qty": "½ lb.",
      "item": "candied cherries"
     },
     {
      "qty": "2 lb.",
      "item": "English walnuts"
     },
     {
      "qty": "½ lb.",
      "item": "Brazil nuts"
     },
     {
      "qty": "½ lb.",
      "item": "pecans"
     }
    ]
   },
   {
    "name": "Also needed",
    "items": [
     {
      "qty": "",
      "item": "butter, for the dish"
     }
    ]
   }
  ],
  "steps": [
   "Put sugar, cream and syrup together and boil to the soft-ball stage (238°F on a candy thermometer).",
   "Remove from heat, add vanilla and beat for 10 minutes.",
   "When it begins to thicken, add fruit and nuts.",
   "Butter a large Pyrex dish and press the mixture in with your hands.",
   "Let cool and cut into small squares."
  ],
  "tips": [
   "This is a very rich candy."
  ],
  "ovenTemp": null,
  "cookTime": null,
  "yield": null,
  "editorNotes": [
   "Walnuts read \"2 1b.\" (2 lb.); every other fruit and nut is ½ lb., so this may be an OCR error for ½ lb.",
   "\"Coffee cream\" is light cream (about 18–20% fat).",
   "Titled \"Week End Candy\" in the source."
  ]
 },
 {
  "id": "pineapple-dessert",
  "title": "Pineapple Dessert",
  "category": "Desserts",
  "book": "centennial",
  "contributor": "Mrs. George Hoylman",
  "contributorRole": null,
  "city": "Gassaway",
  "state": "West Virginia",
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "1 stick",
      "item": "butter or oleo"
     },
     {
      "qty": "1 cup",
      "item": "sugar"
     },
     {
      "qty": "2",
      "item": "egg yolks, beaten"
     },
     {
      "qty": "1 cup",
      "item": "milk"
     },
     {
      "qty": "24",
      "item": "graham crackers, finely crumbed"
     },
     {
      "qty": "½ cup",
      "item": "broken pecans"
     },
     {
      "qty": "Pinch",
      "item": "salt"
     },
     {
      "qty": "1 tsp.",
      "item": "vanilla"
     },
     {
      "qty": "2",
      "item": "egg whites, stiffly beaten"
     }
    ]
   },
   {
    "name": "Topping",
    "items": [
     {
      "qty": "1 small can",
      "item": "crushed pineapple"
     },
     {
      "qty": "1 cup",
      "item": "sugar"
     }
    ]
   }
  ],
  "steps": [
   "Cream butter and sugar together.",
   "Add beaten egg yolks, milk, graham cracker crumbs, nuts, salt and vanilla; mix well.",
   "Fold in stiffly beaten egg whites.",
   "Put in a buttered baking pan and bake 30 minutes at 325°F.",
   "While it bakes, cook the pineapple and sugar together for 15 minutes.",
   "When the first mixture comes out of the oven, pour the pineapple mixture over it.",
   "When cool, place in the refrigerator."
  ],
  "tips": [
   "Keeps for 2 days."
  ],
  "ovenTemp": "325°F",
  "cookTime": "30 minutes",
  "yield": "Serves 10",
  "editorNotes": [
   "Egg whites are used in the method but not listed; assumed to be the whites of the 2 eggs.",
   "\"1 Small can crushed\" appears twice in the list; treated as one can of crushed pineapple for the topping."
  ]
 },
 {
  "id": "carrot-pudding",
  "title": "Carrot Pudding",
  "category": "Desserts",
  "book": "centennial",
  "contributor": "Margaret Anderson",
  "contributorRole": "President, Utah Federation of Women's Clubs",
  "city": null,
  "state": "Utah",
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "1 cup",
      "item": "ground raw potatoes"
     },
     {
      "qty": "1 cup",
      "item": "ground raw carrots"
     },
     {
      "qty": "1 cup",
      "item": "ground raw apples"
     },
     {
      "qty": "1 cup",
      "item": "sugar"
     },
     {
      "qty": "¼ cup",
      "item": "butter, melted"
     },
     {
      "qty": "½ cup",
      "item": "ground suet"
     },
     {
      "qty": "2 cups",
      "item": "seedless raisins"
     },
     {
      "qty": "1 cup",
      "item": "currants"
     },
     {
      "qty": "1 cup",
      "item": "nuts"
     },
     {
      "qty": "1 cup",
      "item": "dry bread crumbs"
     },
     {
      "qty": "1 tsp.",
      "item": "cinnamon"
     },
     {
      "qty": "1 tsp.",
      "item": "nutmeg"
     },
     {
      "qty": "1 tsp.",
      "item": "soda"
     },
     {
      "qty": "½ tsp.",
      "item": "salt"
     },
     {
      "qty": "",
      "item": "enough flour to hold together"
     }
    ]
   }
  ],
  "steps": [
   "Mix all ingredients together.",
   "Steam 2½ hours.",
   "Serve hot with sauce."
  ],
  "tips": [],
  "ovenTemp": null,
  "cookTime": "2½ hours (steamed)",
  "yield": null,
  "editorNotes": [
   "The flour line is cut off in the source (\"Enough flour to hold in-\"); read as enough to hold the mixture together.",
   "No sauce recipe is given, and no mold or steaming method is described.",
   "Location given only as the Utah Federation; no city printed."
  ]
 },
 {
  "id": "grandmother-s-suet-pudding",
  "title": "Grandmother's Suet Pudding",
  "category": "Desserts",
  "book": "centennial",
  "contributor": "Mrs. Tim Babcock",
  "contributorRole": "Governor's Mansion",
  "city": "Helena",
  "state": "Montana",
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "1½ cups",
      "item": "sifted flour"
     },
     {
      "qty": "1½ tsp.",
      "item": "baking powder"
     },
     {
      "qty": "¾ tsp.",
      "item": "soda"
     },
     {
      "qty": "1 tsp.",
      "item": "salt"
     },
     {
      "qty": "1 tsp.",
      "item": "cinnamon"
     },
     {
      "qty": "½ tsp.",
      "item": "ground cloves"
     },
     {
      "qty": "½ tsp.",
      "item": "nutmeg"
     },
     {
      "qty": "¾ cup",
      "item": "fresh ground suet"
     },
     {
      "qty": "½ cup",
      "item": "chopped nuts"
     },
     {
      "qty": "1 cup",
      "item": "seedless raisins"
     },
     {
      "qty": "1",
      "item": "egg, slightly beaten"
     },
     {
      "qty": "¾ cup",
      "item": "milk"
     },
     {
      "qty": "¾ cup",
      "item": "light molasses"
     }
    ]
   }
  ],
  "steps": [
   "Sift together flour, baking powder, soda, salt, cinnamon, cloves and nutmeg.",
   "Add suet, nuts and raisins.",
   "Combine egg, milk and molasses; add to the flour mixture and stir only until the dry ingredients are moistened.",
   "Pour into a well-greased 2-quart mold, bowl or casserole. Cover tightly with a lid or aluminum foil.",
   "Place on a rack in a large steamer and cover tightly.",
   "Steam 2 to 2½ hours, adding more water during steaming if necessary."
  ],
  "tips": [
   "May be frozen and reheated."
  ],
  "ovenTemp": null,
  "cookTime": "2–2½ hours (steamed)",
  "yield": "Serves 10",
  "editorNotes": [
   "Cloves read \"1/2 ground cloves\" with no unit; ½ tsp. is a best guess.",
   "Steaming time reads \"2-22 hours\"; taken as 2 to 2½ hours.",
   "Titled \"Grandmothers Suet Pudding\" in the source."
  ]
 },
 {
  "id": "date-and-nut-pudding",
  "title": "Date and Nut Pudding",
  "category": "Desserts",
  "book": "centennial",
  "contributor": "Mrs. Walter W. Brewer",
  "contributorRole": null,
  "city": "Omar",
  "state": "West Virginia",
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "1 cup",
      "item": "sugar"
     },
     {
      "qty": "½ stick",
      "item": "butter or oleo"
     },
     {
      "qty": "1½ cups",
      "item": "bread crumbs"
     },
     {
      "qty": "1 cup",
      "item": "sweet milk"
     },
     {
      "qty": "1",
      "item": "egg"
     },
     {
      "qty": "1 cup",
      "item": "chopped dates"
     },
     {
      "qty": "1 cup",
      "item": "chopped nuts"
     },
     {
      "qty": "½ cup",
      "item": "flour"
     },
     {
      "qty": "1 tsp.",
      "item": "baking powder"
     },
     {
      "qty": "1 tsp.",
      "item": "vanilla"
     }
    ]
   }
  ],
  "steps": [
   "Cream sugar and butter.",
   "Soften bread crumbs in milk; add the egg, dates and nuts, and mix everything together.",
   "Add the flour, baking powder and vanilla and mix well.",
   "Bake in a greased sheet pan 30–40 minutes."
  ],
  "tips": [
   "Serve with whipped cream or Dream Whip."
  ],
  "ovenTemp": null,
  "cookTime": "30–40 minutes",
  "yield": null,
  "editorNotes": [
   "No oven temperature is given."
  ]
 },
 {
  "id": "ozark-pudding",
  "title": "Ozark Pudding",
  "category": "Desserts",
  "book": "centennial",
  "contributor": "Mrs. T. A. Maynard",
  "contributorRole": null,
  "city": "Logan",
  "state": "West Virginia",
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "1",
      "item": "egg"
     },
     {
      "qty": "¾ cup",
      "item": "sugar"
     },
     {
      "qty": "2 Tbsp.",
      "item": "flour"
     },
     {
      "qty": "1½ tsp.",
      "item": "baking powder"
     },
     {
      "qty": "⅛ tsp.",
      "item": "salt"
     },
     {
      "qty": "½ cup",
      "item": "raw apples or pears"
     },
     {
      "qty": "½ cup",
      "item": "chopped pecans"
     },
     {
      "qty": "1 tsp.",
      "item": "vanilla"
     }
    ]
   }
  ],
  "steps": [
   "Beat egg and sugar together until smooth.",
   "Sift flour, baking powder and salt together and add to the egg mixture.",
   "Add apples, pecans and vanilla.",
   "Bake in a greased tin at 350°F for 30 minutes."
  ],
  "tips": [],
  "ovenTemp": "350°F",
  "cookTime": "30 minutes",
  "yield": null,
  "editorNotes": []
 },
 {
  "id": "coffee-ice-cream-pie",
  "title": "Coffee Ice Cream Pie",
  "category": "Pies",
  "book": "centennial",
  "contributor": "Mrs. C. D. Rumbaugh",
  "contributorRole": null,
  "city": "Logan",
  "state": "West Virginia",
  "ingredientGroups": [
   {
    "name": "Crust",
    "items": [
     {
      "qty": "2 oz.",
      "item": "square chocolate"
     },
     {
      "qty": "2 Tbsp.",
      "item": "butter or oleo"
     },
     {
      "qty": "2 Tbsp.",
      "item": "hot milk"
     },
     {
      "qty": "⅔ cup",
      "item": "sifted confectioners' sugar"
     },
     {
      "qty": "½ cup",
      "item": "coconut"
     }
    ]
   },
   {
    "name": "Filling",
    "items": [
     {
      "qty": "1 qt.",
      "item": "vanilla ice cream"
     },
     {
      "qty": "2 tsp.",
      "item": "instant coffee"
     },
     {
      "qty": "¼ cup",
      "item": "chopped pecans"
     }
    ]
   }
  ],
  "steps": [
   "Melt chocolate and butter.",
   "Stir milk into sugar and add the chocolate; stir in coconut.",
   "Press into a buttered 9-inch pan and chill.",
   "Stir coffee and nuts into softened ice cream.",
   "Pour into the crust and freeze."
  ],
  "tips": [],
  "ovenTemp": null,
  "cookTime": null,
  "yield": null,
  "editorNotes": [
   "Pecans read \"4 Cup\"; ¼ cup is a best guess.",
   "The source is unclear whether instant coffee is dissolved first; it says only to stir coffee into the softened ice cream."
  ]
 },
 {
  "id": "kibbie",
  "title": "Kibbie",
  "category": "Main Dishes",
  "book": "centennial",
  "contributor": "Mrs. S. A. Ammar",
  "contributorRole": null,
  "city": "Logan",
  "state": "West Virginia",
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "2 cups",
      "item": "cracked wheat"
     },
     {
      "qty": "1½ lbs.",
      "item": "lean lamb or beef"
     },
     {
      "qty": "1 large",
      "item": "onion"
     },
     {
      "qty": "",
      "item": "salt and pepper to taste"
     },
     {
      "qty": "Dash",
      "item": "cinnamon"
     }
    ]
   },
   {
    "name": "Filling",
    "items": [
     {
      "qty": "1 lb.",
      "item": "lamb or beef, chopped"
     },
     {
      "qty": "2 Tbsp.",
      "item": "chopped onion"
     },
     {
      "qty": "½ cup",
      "item": "pine nuts"
     },
     {
      "qty": "",
      "item": "butter"
     },
     {
      "qty": "",
      "item": "salt and pepper"
     }
    ]
   },
   {
    "name": "Also needed",
    "items": [
     {
      "qty": "",
      "item": "oil, for frying"
     }
    ]
   }
  ],
  "steps": [
   "Wash cracked wheat and set aside.",
   "Put the lamb or beef and the onion through a meat grinder.",
   "Season with salt, pepper and a dash of cinnamon; mix well.",
   "Add the cracked wheat, mix thoroughly and put through the grinder again.",
   "For the filling, brown the finely chopped meat in butter with the onion, salt, pepper and pine nuts.",
   "Shape small portions of the wheat mixture, open a hollow with one finger, fill with the filling and close both ends.",
   "Fry in hot oil until brown."
  ],
  "tips": [],
  "ovenTemp": null,
  "cookTime": null,
  "yield": null,
  "editorNotes": [
   "Meat reads \"12 Lbs.\"; 1½ lbs. is a best guess.",
   "Portion size reads \"about the size of an elf\" — probably \"egg\".",
   "Kibbie (kibbeh) is a Lebanese dish; Logan County had a sizeable Lebanese community.",
   "In the source the filling recipe follows the shaping step; it is moved here so the filling is ready before shaping."
  ]
 },
 {
  "id": "cheese-stuffed-mushrooms",
  "title": "Cheese-Stuffed Mushrooms",
  "category": "Appetizers & Snacks",
  "book": "mountain",
  "contributor": "Mrs. Marsha Pushkin",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "18",
      "item": "medium mushrooms"
     },
     {
      "qty": "",
      "item": "melted butter"
     },
     {
      "qty": "1 (3 oz.) pkg.",
      "item": "cream cheese, softened"
     },
     {
      "qty": "¼ cup",
      "item": "grated Parmesan cheese"
     },
     {
      "qty": "2 Tbsp.",
      "item": "milk"
     },
     {
      "qty": "⅛ tsp.",
      "item": "onion juice"
     },
     {
      "qty": "",
      "item": "sliced almonds"
     }
    ]
   }
  ],
  "steps": [
   "Wipe mushrooms with a damp cloth; remove the stems for another use.",
   "Roll caps in melted butter.",
   "Beat softened cream cheese until light; beat in Parmesan, milk and onion juice.",
   "Fill the caps with the cheese mixture and top each with a sliced almond.",
   "Arrange on a buttered baking sheet and bake at 350°F for 15 minutes, or until lightly browned."
  ],
  "tips": [
   "Serve immediately."
  ],
  "ovenTemp": "350°F",
  "cookTime": "15 minutes",
  "yield": "Serves 6",
  "editorNotes": [
   "This recipe begins a section printed from \"Mountain Measures: A Collection of West Virginia Recipes,\" compiled by the Junior League of Charleston, West Virginia. No contributor locations are printed in this section."
  ]
 },
 {
  "id": "crab-stuffed-mushrooms",
  "title": "Crab-Stuffed Mushrooms",
  "category": "Appetizers & Snacks",
  "book": "mountain",
  "contributor": "Mrs. James L. Surface",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "1 lb. (or more)",
      "item": "large fresh mushrooms"
     },
     {
      "qty": "1 (7 oz.) can",
      "item": "crabmeat, drained"
     },
     {
      "qty": "1 cup",
      "item": "grated sharp Cheddar cheese"
     },
     {
      "qty": "½ cup",
      "item": "mayonnaise"
     },
     {
      "qty": "½ cup",
      "item": "crushed Ritz crackers"
     },
     {
      "qty": "",
      "item": "Parmesan cheese"
     }
    ]
   }
  ],
  "steps": [
   "Remove stems from mushrooms and wash carefully; save stems for another dish.",
   "Combine drained crabmeat and grated cheese. Add mayonnaise and mix well with a fork.",
   "Stuff the mixture into each cap and sprinkle with crushed crackers.",
   "Bake 10 minutes at 350°F.",
   "Sprinkle with Parmesan and run under the broiler until bubbly."
  ],
  "tips": [
   "Serve as an appetizer, or as a first course in individual seafood shells."
  ],
  "ovenTemp": "350°F",
  "cookTime": "10 minutes",
  "yield": "Serves 8 as an appetizer or 4 as a first course",
  "editorNotes": []
 },
 {
  "id": "ham-stuffed-mushrooms",
  "title": "Ham-Stuffed Mushrooms",
  "category": "Appetizers & Snacks",
  "book": "mountain",
  "contributor": "Mrs. John D. Amos",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "2 dozen",
      "item": "large fresh mushrooms, whole"
     },
     {
      "qty": "1 cup",
      "item": "diced country ham, cooked"
     },
     {
      "qty": "1 cup",
      "item": "fresh mushrooms, chopped"
     },
     {
      "qty": "½ cup",
      "item": "minced onion"
     },
     {
      "qty": "1 cup",
      "item": "bread crumbs, plus more for dusting"
     },
     {
      "qty": "2",
      "item": "garlic cloves"
     },
     {
      "qty": "1 Tbsp.",
      "item": "olive oil, plus more for the skillet"
     },
     {
      "qty": "6 tsp.",
      "item": "brandy"
     }
    ]
   }
  ],
  "steps": [
   "Remove stems from mushroom caps; wipe caps with a damp cloth and set aside.",
   "Sauté onion in 1 Tbsp. olive oil until transparent. Add ham and chopped mushrooms and heat.",
   "Mix the onion, mushroom and ham mixture with bread crumbs in a bowl.",
   "Fill mushroom caps with the mixture.",
   "Put ⅛ inch olive oil in a skillet, brown the garlic cloves and remove them.",
   "Put caps in, filled side up, and cook very slowly for 5 minutes.",
   "Remove with a slotted spoon to a baking dish. Pour ¼ tsp. brandy over each and dust with bread crumbs.",
   "Place under the broiler, 4 inches from heat, and brown the tops."
  ],
  "tips": [
   "Serve immediately."
  ],
  "ovenTemp": null,
  "cookTime": null,
  "yield": null,
  "editorNotes": [
   "A stray fragment (\"mediately.\") appears before the broiling step in the source; it was dropped.",
   "From the Mountain Measures section."
  ]
 },
 {
  "id": "marinated-mushrooms",
  "title": "Marinated Mushrooms",
  "category": "Appetizers & Snacks",
  "book": "mountain",
  "contributor": "Mrs. T. H. Edelblute, Jr.",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "⅓ cup",
      "item": "red wine vinegar"
     },
     {
      "qty": "⅓ cup",
      "item": "salad oil"
     },
     {
      "qty": "1 Tbsp.",
      "item": "brown sugar"
     },
     {
      "qty": "1 tsp.",
      "item": "prepared mustard"
     },
     {
      "qty": "1",
      "item": "onion, thinly sliced (preferably red)"
     },
     {
      "qty": "2 tsp.",
      "item": "dried parsley flakes"
     },
     {
      "qty": "3 cans",
      "item": "mushroom caps, drained (or 3 cups fresh mushrooms, peeled, stems removed, cooked 1 minute and drained)"
     }
    ]
   }
  ],
  "steps": [
   "Simmer everything except the mushrooms for 5 minutes.",
   "Drain mushrooms and add to the marinade.",
   "Refrigerate at least 24 hours (up to 2 weeks)."
  ],
  "tips": [
   "Remove from the refrigerator at least 1 hour before serving; they are best at room temperature.",
   "Serve in a bowl of marinade with toothpicks.",
   "Variation: add canned artichokes to the marinade."
  ],
  "ovenTemp": null,
  "cookTime": null,
  "yield": null,
  "editorNotes": [
   "From the Mountain Measures section."
  ]
 },
 {
  "id": "super-ramaki",
  "title": "Super Ramaki",
  "category": "Appetizers & Snacks",
  "book": "mountain",
  "contributor": "Mrs. Kenneth Underwood",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "12",
      "item": "chicken livers"
     },
     {
      "qty": "¼ cup",
      "item": "soy sauce"
     },
     {
      "qty": "¼ cup",
      "item": "bourbon"
     },
     {
      "qty": "12",
      "item": "water chestnuts"
     },
     {
      "qty": "",
      "item": "brown sugar"
     },
     {
      "qty": "12 strips",
      "item": "bacon"
     }
    ]
   }
  ],
  "steps": [
   "Cut raw livers in half and soak 4 hours in soy sauce and bourbon.",
   "Drain on paper towels. Cut water chestnuts in half.",
   "Slit each liver and slide a water chestnut half into the cavity.",
   "Roll in brown sugar, packing the sugar onto the liver.",
   "Lay each liver on ½ strip of uncooked bacon, roll up and secure with a toothpick.",
   "Lay on a jelly roll pan and add a little more brown sugar.",
   "Bake at 400°F for 20–30 minutes, turning once or twice."
  ],
  "tips": [
   "Can be assembled the day before and covered tightly; bake just before serving."
  ],
  "ovenTemp": "400°F",
  "cookTime": "20–30 minutes",
  "yield": null,
  "editorNotes": [
   "\"Ramaki\" is likely a spelling of rumaki; kept as printed.",
   "From the Mountain Measures section."
  ]
 },
 {
  "id": "pecan-spread",
  "title": "Pecan Spread",
  "category": "Appetizers & Snacks",
  "book": "mountain",
  "contributor": "Mrs. Robert J. Singleton",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "1 (8 oz.) pkg.",
      "item": "cream cheese, softened"
     },
     {
      "qty": "2 Tbsp.",
      "item": "milk"
     },
     {
      "qty": "1 (2½ oz.) jar",
      "item": "sliced dried beef"
     },
     {
      "qty": "¼ cup",
      "item": "finely chopped green pepper (optional)"
     },
     {
      "qty": "2 Tbsp.",
      "item": "dehydrated onion flakes"
     },
     {
      "qty": "½ tsp.",
      "item": "garlic salt"
     },
     {
      "qty": "¼ tsp.",
      "item": "pepper"
     },
     {
      "qty": "½ cup",
      "item": "sour cream"
     }
    ]
   },
   {
    "name": "Topping",
    "items": [
     {
      "qty": "½ cup",
      "item": "coarsely chopped pecans"
     },
     {
      "qty": "2 Tbsp.",
      "item": "butter or margarine"
     },
     {
      "qty": "½ tsp.",
      "item": "salt"
     }
    ]
   }
  ],
  "steps": [
   "Combine cream cheese and milk until well blended.",
   "Stir in dried beef, green pepper, onion flakes and seasonings; mix well.",
   "Fold in sour cream and spoon into an 8-inch pie plate.",
   "Heat and crisp pecans in melted butter with the salt; sprinkle over the cream cheese mixture.",
   "Bake at 350°F for 20 minutes."
  ],
  "tips": [
   "Serve hot with crackers."
  ],
  "ovenTemp": "350°F",
  "cookTime": "20 minutes",
  "yield": null,
  "editorNotes": [
   "From the Mountain Measures section."
  ]
 },
 {
  "id": "crunchy-salad",
  "title": "Crunchy Salad",
  "category": "Salads",
  "book": "mountain",
  "contributor": "Mrs. Leigh Shepherd",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "½ cup",
      "item": "roasted sunflower seed meats"
     },
     {
      "qty": "½ cup",
      "item": "nuts (or 1 cup small shrimp)"
     },
     {
      "qty": "2 Tbsp.",
      "item": "raw wheat germ"
     },
     {
      "qty": "1 tsp.",
      "item": "dried parsley (or 1 Tbsp. chopped fresh)"
     },
     {
      "qty": "2½ cups",
      "item": "shredded lettuce"
     },
     {
      "qty": "1 cup",
      "item": "diced mild cheese"
     },
     {
      "qty": "½ cup",
      "item": "bean sprouts, fresh or canned"
     },
     {
      "qty": "1 cup",
      "item": "diced cucumber"
     },
     {
      "qty": "2 Tbsp.",
      "item": "crumbled bacon"
     }
    ]
   }
  ],
  "steps": [
   "Mix seeds, nuts, wheat germ and parsley.",
   "Combine with the remaining ingredients in a medium salad bowl.",
   "Divide into two portions and serve with dressing."
  ],
  "tips": [],
  "ovenTemp": null,
  "cookTime": null,
  "yield": "2 servings",
  "editorNotes": [
   "\"1 teason\" read as 1 teaspoon.",
   "No dressing recipe or type is specified.",
   "From the Mountain Measures section."
  ]
 },
 {
  "id": "ramp-salad",
  "title": "Ramp Salad",
  "category": "Salads",
  "book": "mountain",
  "contributor": "Mrs. Carl B. Hall, Jr.",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "",
      "item": "ramps, cut fine"
     },
     {
      "qty": "",
      "item": "salt to taste"
     },
     {
      "qty": "",
      "item": "ham pieces (and ham fryings)"
     },
     {
      "qty": "",
      "item": "vinegar"
     },
     {
      "qty": "",
      "item": "hard-cooked eggs, sliced"
     }
    ]
   }
  ],
  "steps": [
   "Cook ramps until tender, but do not parboil.",
   "Season with salt, ham fryings and vinegar.",
   "Garnish with sliced hard-cooked eggs."
  ],
  "tips": [
   "Serve warm as a salad.",
   "\"Didn't believe ramps were so good.\""
  ],
  "ovenTemp": null,
  "cookTime": null,
  "yield": null,
  "editorNotes": [
   "No quantities are given for any ingredient.",
   "\"Ham fryings\" means the drippings left from frying ham.",
   "From the Mountain Measures section."
  ]
 },
 {
  "id": "cranberry-salad",
  "title": "Cranberry Salad",
  "category": "Salads",
  "book": "mountain",
  "contributor": "Mrs. Leslie Hawker",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "1 (3 oz.) pkg.",
      "item": "cherry gelatin"
     },
     {
      "qty": "1 cup",
      "item": "hot water"
     },
     {
      "qty": "1 cup",
      "item": "sugar"
     },
     {
      "qty": "1 Tbsp.",
      "item": "lemon juice"
     },
     {
      "qty": "1 cup",
      "item": "pineapple syrup"
     },
     {
      "qty": "1 cup",
      "item": "ground cranberries"
     },
     {
      "qty": "1 whole",
      "item": "orange, grated with peel"
     },
     {
      "qty": "1 cup",
      "item": "crushed pineapple, drained"
     },
     {
      "qty": "1 cup",
      "item": "English walnuts"
     }
    ]
   }
  ],
  "steps": [
   "Dissolve gelatin in hot water.",
   "Add sugar, lemon juice and pineapple syrup. Stir and chill until thickened.",
   "Add the remaining ingredients before the gelatin sets.",
   "Pour into a mold and refrigerate until firm."
  ],
  "tips": [],
  "ovenTemp": null,
  "cookTime": null,
  "yield": "Serves 10",
  "editorNotes": [
   "Gelatin package size is missing (\"1 (ounce) package\"); 3 oz. is a best guess.",
   "\"Pineapple syrup\" is presumably the juice drained from the crushed pineapple.",
   "From the Mountain Measures section."
  ]
 },
 {
  "id": "gumdrop-fruit-salad",
  "title": "Gumdrop Fruit Salad",
  "category": "Salads",
  "book": "mountain",
  "contributor": "Mrs. Estil Monk",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "1 cup",
      "item": "whipping cream"
     },
     {
      "qty": "¾ cup",
      "item": "gumdrops, cut fine (omit black ones)"
     },
     {
      "qty": "2½ cups",
      "item": "pineapple tidbits, drained"
     },
     {
      "qty": "1 (4 oz.) jar",
      "item": "maraschino cherries, cut and drained"
     },
     {
      "qty": "2 cups",
      "item": "seeded grapes"
     },
     {
      "qty": "2 cups",
      "item": "miniature marshmallows"
     },
     {
      "qty": "½ cup",
      "item": "chopped pecans"
     }
    ]
   },
   {
    "name": "Dressing",
    "items": [
     {
      "qty": "½ cup",
      "item": "pineapple juice"
     },
     {
      "qty": "¼ cup",
      "item": "sugar"
     },
     {
      "qty": "2 Tbsp.",
      "item": "flour"
     },
     {
      "qty": "¼ tsp.",
      "item": "salt"
     },
     {
      "qty": "3 Tbsp.",
      "item": "lemon juice"
     },
     {
      "qty": "1½ tsp.",
      "item": "vinegar"
     }
    ]
   }
  ],
  "steps": [
   "For the dressing, blend all dressing ingredients in a saucepan and cook until thick, stirring constantly. Cool.",
   "Whip the cream and stir in all the salad ingredients.",
   "Add the cooled dressing and refrigerate overnight."
  ],
  "tips": [],
  "ovenTemp": null,
  "cookTime": null,
  "yield": "Serves 8–10 generously",
  "editorNotes": [
   "In the source the dressing recipe follows the salad; moved first since it must cool before use.",
   "From the Mountain Measures section."
  ]
 },
 {
  "id": "strawberry-salad",
  "title": "Strawberry Salad",
  "category": "Salads",
  "book": "mountain",
  "contributor": "Mrs. Harry Wise",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "2 (3 oz.) boxes",
      "item": "strawberry gelatin"
     },
     {
      "qty": "1½ cups",
      "item": "boiling water"
     },
     {
      "qty": "2 (10 oz.) pkgs.",
      "item": "frozen strawberries, unthawed"
     },
     {
      "qty": "2 to 3",
      "item": "bananas, mashed"
     },
     {
      "qty": "1 (20 oz.) can",
      "item": "crushed pineapple, drained"
     },
     {
      "qty": "1 cup",
      "item": "chopped nuts"
     },
     {
      "qty": "1 cup",
      "item": "sour cream, or whipping cream, whipped"
     }
    ]
   }
  ],
  "steps": [
   "Mix gelatin and boiling water until dissolved.",
   "Add frozen strawberries and stir until thick.",
   "Add bananas, pineapple and nuts.",
   "Pour half the mixture into a 13×9×2-inch pan and refrigerate until set.",
   "Spread with sour cream or whipped cream, then cover with the remaining gelatin mixture.",
   "Refrigerate."
  ],
  "tips": [
   "Also good as a dessert."
  ],
  "ovenTemp": null,
  "cookTime": null,
  "yield": "Serves 10–12",
  "editorNotes": []
 },
 {
  "id": "antique-muffins",
  "title": "Antique Muffins",
  "category": "Breads",
  "book": "mountain",
  "contributor": "Mrs. C. K. Payne, III",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "2 cups",
      "item": "sifted enriched self-rising flour"
     },
     {
      "qty": "⅓ cup",
      "item": "sugar"
     },
     {
      "qty": "1 tsp.",
      "item": "cinnamon"
     },
     {
      "qty": "1 cup",
      "item": "chopped peeled apple (1 medium)"
     },
     {
      "qty": "½ cup",
      "item": "chopped nuts"
     },
     {
      "qty": "1 cup",
      "item": "sour cream"
     },
     {
      "qty": "1",
      "item": "egg, beaten"
     },
     {
      "qty": "½ cup",
      "item": "milk"
     },
     {
      "qty": "¼ cup",
      "item": "sugar, for topping"
     }
    ]
   }
  ],
  "steps": [
   "Sift together flour, sugar and cinnamon. Stir in apple and nuts.",
   "Reserve ¼ cup sour cream. Blend egg and milk with the remaining sour cream.",
   "Add the liquid all at once to the flour mixture, stirring only until moistened.",
   "Fill large greased muffin cups ⅔ full.",
   "Drop 1 tsp. reserved sour cream in the center of each and cover with 1 tsp. sugar.",
   "Bake at 425°F for 20–25 minutes, or until edges are golden brown."
  ],
  "tips": [],
  "ovenTemp": "425°F",
  "cookTime": "20–25 minutes",
  "yield": "12 large muffins",
  "editorNotes": [
   "From the Mountain Measures section."
  ]
 },
 {
  "id": "persimmonhickory-nut-bread",
  "title": "Persimmon–Hickory Nut Bread",
  "category": "Breads",
  "book": "mountain",
  "contributor": "Euell Gibbons",
  "contributorRole": "Forager and author of Stalking the Wild Asparagus; led nature weekends at North Bend State Park, West Virginia",
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "2 cups",
      "item": "flour"
     },
     {
      "qty": "1 tsp.",
      "item": "soda"
     },
     {
      "qty": "1 cup",
      "item": "sugar"
     },
     {
      "qty": "1½ sticks",
      "item": "margarine"
     },
     {
      "qty": "2",
      "item": "eggs, well beaten"
     },
     {
      "qty": "1 cup",
      "item": "persimmon pulp"
     },
     {
      "qty": "½ cup",
      "item": "hickory nuts or black walnuts, chopped"
     }
    ]
   }
  ],
  "steps": [
   "Sift flour and soda together.",
   "In a separate bowl, cream sugar with margarine and add the beaten eggs.",
   "Add the flour mixture, persimmon pulp and nuts; stir into a very stiff batter.",
   "Line 2 small loaf pans with waxed paper and divide the batter between them.",
   "Bake 1 hour at 325°F."
  ],
  "tips": [],
  "ovenTemp": "325°F",
  "cookTime": "1 hour",
  "yield": "2 small loaves",
  "editorNotes": [
   "Name appears as both \"Evell\" and \"Euell\" in the source; Euell is correct.",
   "From the Mountain Measures section."
  ]
 },
 {
  "id": "pumpkin-bread",
  "title": "Pumpkin Bread",
  "category": "Breads",
  "book": "mountain",
  "contributor": "Mrs. Richard Repaire",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "6",
      "item": "eggs"
     },
     {
      "qty": "3 cups",
      "item": "sugar"
     },
     {
      "qty": "4½ cups",
      "item": "flour"
     },
     {
      "qty": "3 tsp.",
      "item": "baking powder"
     },
     {
      "qty": "3 tsp.",
      "item": "soda"
     },
     {
      "qty": "3 tsp.",
      "item": "salt"
     },
     {
      "qty": "3 tsp.",
      "item": "cinnamon"
     },
     {
      "qty": "2 cups + 4 tsp.",
      "item": "cooking oil"
     },
     {
      "qty": "3½ to 4 cups",
      "item": "pumpkin"
     },
     {
      "qty": "3 tsp.",
      "item": "vanilla"
     },
     {
      "qty": "1 cup or more",
      "item": "chopped nuts (optional)"
     }
    ]
   }
  ],
  "steps": [
   "Mix eggs and sugar. Sift remaining dry ingredients together.",
   "Add oil and dry ingredients alternately with pumpkin.",
   "Add vanilla and fold in nuts.",
   "Grease 5 (1 lb.) coffee cans and fill each about half full.",
   "Bake at 350°F for 50–60 minutes."
  ],
  "tips": [],
  "ovenTemp": "350°F",
  "cookTime": "50–60 minutes",
  "yield": "5 loaves (1-lb. coffee cans)",
  "editorNotes": [
   "Oil amount reads \"2 cups and 4 teaspoons\" as printed."
  ]
 },
 {
  "id": "doughnut-coffee-cake",
  "title": "Doughnut Coffee Cake",
  "category": "Breads",
  "book": "mountain",
  "contributor": "Mrs. Steven Thomas, III",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "4 rolls",
      "item": "refrigerated doughnut dough (dairy case)"
     },
     {
      "qty": "1 (6 oz.) can",
      "item": "frozen orange juice, undiluted"
     },
     {
      "qty": "2 cups",
      "item": "brown sugar"
     },
     {
      "qty": "1 tsp.",
      "item": "nutmeg"
     },
     {
      "qty": "1 Tbsp.",
      "item": "cinnamon"
     },
     {
      "qty": "1 tsp.",
      "item": "ground cardamom"
     },
     {
      "qty": "2 cups",
      "item": "chopped pecans"
     },
     {
      "qty": "½ lb.",
      "item": "margarine"
     },
     {
      "qty": "",
      "item": "fresh orange slices"
     }
    ]
   }
  ],
  "steps": [
   "Line the bottom of a 13-inch spring tube pan with foil, then grease.",
   "Divide each doughnut piece in half and roll each half into a small ball.",
   "Arrange balls in the pan so they are just touching.",
   "Drizzle with ⅓ of the orange juice. Mix brown sugar with spices; sprinkle ⅓ of it and ⅓ of the pecans over the balls. Dot with ⅓ of the margarine.",
   "Repeat twice more to make 3 layers, garnishing the top layer with fresh orange slices before the nuts, sugar and margarine.",
   "Cover with a damp cloth and let rise about 3 hours in a warm place.",
   "Bake at 400°F for 35–40 minutes."
  ],
  "tips": [],
  "ovenTemp": "400°F",
  "cookTime": "35–40 minutes",
  "yield": "Serves 20–25",
  "editorNotes": [
   "\"Rolls doughnuts (found in dairy case)\" refers to refrigerated canned dough; the exact product is unclear today — refrigerated biscuit dough is the closest substitute.",
   "A 13-inch spring tube pan is unusually large; the size is as printed.",
   "The top layer says \"butter\" though margarine is listed."
  ]
 },
 {
  "id": "hungarian-coffee-cake",
  "title": "Hungarian Coffee Cake",
  "category": "Breads",
  "book": "mountain",
  "contributor": "Mrs. Seigle W. Parks",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": "Dough",
    "items": [
     {
      "qty": "1 cup",
      "item": "milk, scalded"
     },
     {
      "qty": "1 tsp.",
      "item": "salt"
     },
     {
      "qty": "¼ cup",
      "item": "sugar"
     },
     {
      "qty": "¼ cup",
      "item": "butter"
     },
     {
      "qty": "1 package",
      "item": "dry yeast (or 1 cake)"
     },
     {
      "qty": "¼ cup",
      "item": "warm water"
     },
     {
      "qty": "1",
      "item": "egg"
     },
     {
      "qty": "3½ cups",
      "item": "flour"
     }
    ]
   },
   {
    "name": "Coating",
    "items": [
     {
      "qty": "1 cup",
      "item": "granulated sugar"
     },
     {
      "qty": "2 Tbsp.",
      "item": "cinnamon"
     },
     {
      "qty": "1 cup",
      "item": "chopped nut meats"
     },
     {
      "qty": "6 Tbsp.",
      "item": "melted butter"
     }
    ]
   }
  ],
  "steps": [
   "Add salt, sugar and butter to the scalded milk.",
   "Dissolve yeast in warm water. When the milk mixture is lukewarm, add the yeast.",
   "Add egg, then flour in small portions, beating well after each addition. Do not knead.",
   "Place dough in a greased bowl and let rise until double.",
   "Combine sugar, cinnamon and nuts.",
   "Pinch off pieces of dough slightly larger than a walnut; roll each in melted butter, then in the sugar mixture.",
   "Layer the balls in a greased tube pan. Cover and let rise until double again.",
   "Bake at 375°F for 30 minutes.",
   "Let stand 2–3 minutes, then turn upside down onto a large cake plate."
  ],
  "tips": [],
  "ovenTemp": "375°F",
  "cookTime": "30 minutes",
  "yield": null,
  "editorNotes": [
   "From the Mountain Measures section."
  ]
 },
 {
  "id": "pecan-rolls",
  "title": "Pecan Rolls",
  "category": "Breads",
  "book": "mountain",
  "contributor": "Mrs. Meredith K. Rice",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "½ cup",
      "item": "butter"
     },
     {
      "qty": "½ cup",
      "item": "margarine"
     },
     {
      "qty": "1½ cups",
      "item": "milk"
     },
     {
      "qty": "½ cup",
      "item": "warm water"
     },
     {
      "qty": "2 packages",
      "item": "active dry yeast"
     },
     {
      "qty": "1 Tbsp.",
      "item": "sugar"
     },
     {
      "qty": "7 cups",
      "item": "flour"
     },
     {
      "qty": "½ cup",
      "item": "sugar"
     },
     {
      "qty": "2 tsp.",
      "item": "salt"
     },
     {
      "qty": "2",
      "item": "eggs, room temperature"
     },
     {
      "qty": "1",
      "item": "lemon rind, grated"
     }
    ]
   },
   {
    "name": "Filling",
    "items": [
     {
      "qty": "",
      "item": "brown sugar"
     },
     {
      "qty": "",
      "item": "chopped nuts"
     },
     {
      "qty": "",
      "item": "butter"
     }
    ]
   }
  ],
  "steps": [
   "Melt butter and margarine in a small saucepan; add milk and cool to lukewarm.",
   "Add yeast and 1 Tbsp. sugar to the warm water. Do not stir. Let double in volume.",
   "Put flour in a large (4-quart) bowl, make a well and add the yeast mixture. Cover with flour.",
   "Add ½ cup sugar, salt, eggs and lemon rind. Work in the butter-milk mixture with your fingers.",
   "Knead until the dough slides off your fingers, about 5 minutes.",
   "Cover with a wet cloth and let rise until double.",
   "On a floured surface, roll out ⅛ to ¼ inch thick.",
   "Spread with brown sugar and chopped nuts and dot with butter.",
   "Roll jelly-roll fashion and cut with a floured knife.",
   "Place in a greased pan with sides just touching. Let rise 30 minutes.",
   "Bake at 375°F for 30 minutes."
  ],
  "tips": [],
  "ovenTemp": "375°F",
  "cookTime": "30 minutes",
  "yield": null,
  "editorNotes": [
   "Thickness reads \"⅓ to ¼ inch\"; ⅛ to ¼ inch is likely.",
   "From the Mountain Measures section."
  ]
 },
 {
  "id": "wild-plum-marmalade",
  "title": "Wild Plum Marmalade",
  "category": "Preserves & Pickles",
  "book": "mountain",
  "contributor": "Mrs. Tinsley A. Galyean",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "6½ cups",
      "item": "cooked wild plums with their juice (skins and pulp, seeds removed)"
     },
     {
      "qty": "8 cups",
      "item": "sugar"
     },
     {
      "qty": "1 box",
      "item": "Sure-Jell (powdered fruit pectin)"
     },
     {
      "qty": "",
      "item": "paraffin, for sealing"
     }
    ]
   }
  ],
  "steps": [
   "Wash ripe or semi-ripe wild pink plums and just cover with water in a large kettle.",
   "Boil until the skins begin to come off and the insides are soft, about 15 minutes.",
   "When cool, remove the seeds by hand, keeping both skins and pulp. (This is best done wearing clean rubber gloves.)",
   "Measure 6½ cups of fruit and juice into a tall kettle. Stir in the Sure-Jell and bring to a boil, stirring occasionally.",
   "Meanwhile, measure the sugar. Add it all at once, stirring thoroughly so it will not burn.",
   "When the mixture comes to a full, hard boil, continue cooking 1 minute.",
   "Let cool, stir, pour into sterilized jars and top with paraffin."
  ],
  "tips": [
   "Tart, with a pretty color and a wonderful wild, fresh flavor."
  ],
  "ovenTemp": null,
  "cookTime": null,
  "yield": null,
  "editorNotes": [
   "Sealing jars with paraffin is the original 1960s method; current USDA guidance is two-piece canning lids and a boiling-water bath.",
   "No location printed."
  ]
 },
 {
  "id": "sweet-roll",
  "title": "Sweet Roll",
  "category": "Breads",
  "book": "mountain",
  "contributor": null,
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "",
      "item": "melted butter"
     },
     {
      "qty": "",
      "item": "confectioners sugar"
     },
     {
      "qty": "",
      "item": "brown sugar"
     },
     {
      "qty": "",
      "item": "cinnamon"
     },
     {
      "qty": "",
      "item": "chopped nuts (optional)"
     },
     {
      "qty": "",
      "item": "raisins (optional)"
     }
    ]
   },
   {
    "name": "Also needed",
    "items": [
     {
      "qty": "",
      "item": "Tasty Egg Bread dough"
     }
    ]
   }
  ],
  "steps": [
   "Roll out Tasty Egg Bread dough 1 inch thick instead of shaping it into loaves.",
   "Spread with butter and sprinkle liberally with confectioners sugar, brown sugar and cinnamon. Add chopped nuts and raisins if you like.",
   "Roll up as for a jelly roll, slice into 1-inch slices and place in a well-greased pan.",
   "Let rise and bake as for Tasty Egg Bread, but for less time: 425°F for 10 minutes, then 350°F for 15 to 20 minutes.",
   "Ice if desired."
  ],
  "tips": [
   "A sweet cake can also be made from this bread dough — see Sweet Cake."
  ],
  "ovenTemp": "425°F, then 350°F",
  "cookTime": "25–30 minutes",
  "yield": null,
  "editorNotes": [
   "No quantities given for the filling ingredients.",
   "No contributor printed; it sits beside Mrs. Edwin M. Bartrug, Jr.'s Sweet Cake and is likely hers.",
   "Requires the Tasty Egg Bread recipe (printed elsewhere in the book)."
  ]
 },
 {
  "id": "sweet-cake",
  "title": "Sweet Cake",
  "category": "Breads",
  "book": "mountain",
  "contributor": "Mrs. Edwin M. Bartrug, Jr.",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "⅓",
      "item": "of a batch of Tasty Egg Bread dough"
     },
     {
      "qty": "¼ cup",
      "item": "sugar"
     },
     {
      "qty": "⅓ cup",
      "item": "soft butter"
     },
     {
      "qty": "¾ cup",
      "item": "raisins and nuts, mixed"
     },
     {
      "qty": "1",
      "item": "egg, beaten"
     }
    ]
   },
   {
    "name": "Also needed",
    "items": [
     {
      "qty": "",
      "item": "sugar, for sprinkling"
     }
    ]
   }
  ],
  "steps": [
   "Knead the sugar, butter, raisins and nuts into the bread dough.",
   "Shape into a round loaf and place in a buttered pie tin or round cake pan.",
   "Cover and let rise until doubled, about 30 to 40 minutes.",
   "Brush with beaten egg and sprinkle with plenty of sugar.",
   "Bake at 425°F for 10 minutes, then lower to 350°F for 25 to 30 minutes more.",
   "Cut into wedges."
  ],
  "tips": [
   "Instead of sprinkling with sugar before baking, you can put a sugar glaze on top after baking."
  ],
  "ovenTemp": "425°F, then 350°F",
  "cookTime": "35–40 minutes",
  "yield": null,
  "editorNotes": [
   "Requires the Tasty Egg Bread recipe (printed elsewhere in the book)."
  ]
 },
 {
  "id": "chinese-omelet",
  "title": "Chinese Omelet",
  "category": "Main Dishes",
  "book": "mountain",
  "contributor": "Mrs. W. O. McMillan",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "5",
      "item": "eggs"
     },
     {
      "qty": "¾ tsp.",
      "item": "salt"
     },
     {
      "qty": "1 (4–5 oz.) can",
      "item": "water chestnuts, drained and thinly sliced"
     },
     {
      "qty": "½ cup",
      "item": "thinly sliced scallions, green tops included"
     },
     {
      "qty": "1 cup",
      "item": "bean sprouts, drained"
     },
     {
      "qty": "1 medium",
      "item": "green pepper, finely chopped"
     },
     {
      "qty": "½ cup",
      "item": "diced cooked chicken, packed"
     },
     {
      "qty": "¼ cup",
      "item": "vegetable oil"
     }
    ]
   },
   {
    "name": "Chinese Gravy",
    "items": [
     {
      "qty": "½–¾ cup",
      "item": "chicken broth"
     },
     {
      "qty": "2 Tbsp.",
      "item": "cornstarch"
     },
     {
      "qty": "2 Tbsp.",
      "item": "soy sauce"
     }
    ]
   },
   {
    "name": "Also needed",
    "items": [
     {
      "qty": "",
      "item": "cooked rice, for serving"
     }
    ]
   }
  ],
  "steps": [
   "Beat eggs with salt just until yolks and whites are combined and the eggs are slightly foamy.",
   "Add scallions, water chestnuts, green pepper, bean sprouts and chicken. Mix.",
   "Heat oil in a 10-inch skillet over low heat until very hot. Add the egg mixture and spread the vegetables evenly.",
   "Cover tightly and do not stir. The oil should bubble gently so the bottom turns golden brown and the top sets, about 15 minutes.",
   "With a sharp knife, cut into 4 portions in the skillet. Lift out with a wide spatula onto several thicknesses of paper towel to drain.",
   "For the gravy: mix the cornstarch with 2 Tbsp. of the broth to make a paste. Heat the rest of the broth and gradually stir in the paste.",
   "Add soy sauce and cook until the gravy looks clear.",
   "Serve the omelet brown side up at once, with the thin gravy and cooked rice."
  ],
  "tips": [],
  "ovenTemp": null,
  "cookTime": "about 15 minutes",
  "yield": "Serves 4",
  "editorNotes": [
   "The method says to add 'water' with the vegetables, but no water is listed; it most likely means the water chestnuts, so it is left out."
  ]
 },
 {
  "id": "crab-gourmet",
  "title": "Crab Gourmet",
  "category": "Main Dishes",
  "book": "mountain",
  "contributor": "Mrs. Ralph Jones",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "2 cups",
      "item": "canned crabmeat, or frozen crabmeat thawed, picked over and flaked"
     },
     {
      "qty": "½ cup",
      "item": "toasted walnuts, coarsely broken"
     },
     {
      "qty": "2",
      "item": "hard-boiled eggs, chopped"
     },
     {
      "qty": "½ cup",
      "item": "mayonnaise"
     },
     {
      "qty": "2 tsp.",
      "item": "lemon juice"
     },
     {
      "qty": "1 tsp.",
      "item": "Worcestershire sauce"
     },
     {
      "qty": "¼ tsp.",
      "item": "dry mustard"
     },
     {
      "qty": "¼ tsp.",
      "item": "salt"
     },
     {
      "qty": "",
      "item": "dash of cayenne pepper"
     },
     {
      "qty": "1 cup",
      "item": "soft bread crumbs"
     },
     {
      "qty": "¼ cup",
      "item": "melted butter or margarine"
     },
     {
      "qty": "",
      "item": "chopped parsley"
     }
    ]
   }
  ],
  "steps": [
   "Mix the crabmeat lightly with the walnuts and eggs.",
   "Mix the mayonnaise with lemon juice, Worcestershire, mustard, salt and cayenne. Stir into the crab mixture.",
   "Pour gently into a small, shallow casserole.",
   "Top with the bread crumbs mixed with melted butter and parsley.",
   "Bake at 400°F about 20 minutes, until the top is well browned."
  ],
  "tips": [],
  "ovenTemp": "400°F",
  "cookTime": "about 20 minutes",
  "yield": "Serves 4",
  "editorNotes": []
 },
 {
  "id": "seafood-casserole",
  "title": "Seafood Casserole",
  "category": "Main Dishes",
  "book": "mountain",
  "contributor": "Mrs. John M. Slack, III",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "¼ cup",
      "item": "chopped green onions"
     },
     {
      "qty": "3 Tbsp.",
      "item": "butter"
     },
     {
      "qty": "3 Tbsp.",
      "item": "flour"
     },
     {
      "qty": "1 cup",
      "item": "milk"
     },
     {
      "qty": "",
      "item": "salt and pepper"
     },
     {
      "qty": "",
      "item": "cayenne pepper"
     },
     {
      "qty": "1 Tbsp.",
      "item": "Worcestershire sauce"
     },
     {
      "qty": "",
      "item": "a few drops Tabasco sauce"
     },
     {
      "qty": "1 cup",
      "item": "sharp cheese, grated (divided)"
     },
     {
      "qty": "1 cup",
      "item": "shrimp"
     },
     {
      "qty": "1 cup",
      "item": "crabmeat"
     },
     {
      "qty": "3",
      "item": "hard-boiled eggs, chopped"
     },
     {
      "qty": "½ cup",
      "item": "chopped pecans"
     },
     {
      "qty": "1 cup",
      "item": "stuffing mix (divided)"
     }
    ]
   }
  ],
  "steps": [
   "Sauté green onions in butter. Add flour, then milk.",
   "Season with salt, pepper, cayenne, Worcestershire and a few drops of Tabasco.",
   "Stir ¾ cup of the cheese, the shrimp, crabmeat and chopped eggs into the sauce.",
   "Mix the remaining ¼ cup cheese with the pecans and ½ cup of the stuffing mix.",
   "Layer in a casserole: the seafood mixture, then the crumb mixture. Use the rest of the crumbs on top.",
   "Bake at 375°F for 20 to 25 minutes."
  ],
  "tips": [],
  "ovenTemp": "375°F",
  "cookTime": "20–25 minutes",
  "yield": "Serves 6",
  "editorNotes": [
   "OCR 'shri crabmeat' read as shrimp and crabmeat.",
   "Layering is loosely described; the remaining ½ cup stuffing mix appears to be the 'rest of crumbs on top'.",
   "Shrimp: cooked, peeled is implied but not stated."
  ]
 },
 {
  "id": "breakfast-sausage-balls",
  "title": "Breakfast Sausage Balls",
  "category": "Appetizers & Snacks",
  "book": "mountain",
  "contributor": "Mrs. Steven Thomas, III",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "4 slices",
      "item": "bread"
     },
     {
      "qty": "2 Tbsp.",
      "item": "concentrated orange juice"
     },
     {
      "qty": "2 Tbsp.",
      "item": "maple syrup"
     },
     {
      "qty": "1",
      "item": "egg, slightly beaten"
     },
     {
      "qty": "½ lb.",
      "item": "mild bulk sausage"
     },
     {
      "qty": "½ cup",
      "item": "finely chopped roasted pecans"
     },
     {
      "qty": "2 Tbsp.",
      "item": "parsley flakes"
     }
    ]
   }
  ],
  "steps": [
   "Break up the bread in the orange juice and maple syrup.",
   "Add the egg and mix thoroughly. Blend in the remaining ingredients.",
   "Shape into balls about 1 inch across, or into patties.",
   "Fry slowly in a skillet or on a griddle over medium heat until browned."
  ],
  "tips": [
   "Serve as an hors d'oeuvre, or alongside macaroni for a family supper.",
   "Can be made ahead and frozen after cooking. Reheat in a warm oven before serving."
  ],
  "ovenTemp": null,
  "cookTime": null,
  "yield": "4 to 6 patties or 12 to 16 balls",
  "editorNotes": [
   "'Concentrated orange juice' is presumably undiluted frozen orange juice concentrate."
  ]
 },
 {
  "id": "barley-pine-nut-casserole",
  "title": "Barley-Pine Nut Casserole",
  "category": "Vegetables & Sides",
  "book": "mountain",
  "contributor": "Mrs. Frank Baer",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "½ cup",
      "item": "pine nuts"
     },
     {
      "qty": "½ cup",
      "item": "butter (divided)"
     },
     {
      "qty": "1 cup",
      "item": "finely chopped onions"
     },
     {
      "qty": "1 cup",
      "item": "pearl barley"
     },
     {
      "qty": "1 cup",
      "item": "finely chopped parsley"
     },
     {
      "qty": "1 cup",
      "item": "finely chopped chives"
     },
     {
      "qty": "2 cups",
      "item": "canned beef consommé"
     },
     {
      "qty": "1 tsp.",
      "item": "salt"
     },
     {
      "qty": "",
      "item": "pepper to taste"
     }
    ]
   }
  ],
  "steps": [
   "Sauté pine nuts in some of the butter until golden; set aside.",
   "Sauté onion in the remaining butter until golden. Add barley and brown lightly.",
   "Stirring constantly, add parsley, chives and consommé.",
   "Season half the pine nuts with salt and pepper. Pour them with the barley mixture into a 2-quart casserole.",
   "Bake at 350°F for 1 hour, stirring once after 30 minutes.",
   "Sprinkle the remaining pine nuts on top and bake 20 minutes more."
  ],
  "tips": [
   "If it gets too dry, add a little more liquid; barley soaks up liquid at different rates from time to time."
  ],
  "ovenTemp": "350°F",
  "cookTime": "1 hour 20 minutes",
  "yield": "Serves 6",
  "editorNotes": [
   "Printed as '1 teaspoon salt and pepper to taste'; read as 1 tsp. salt plus pepper to taste.",
   "How the butter is divided between pine nuts and onions is not stated."
  ]
 },
 {
  "id": "granola",
  "title": "Granola",
  "category": "Appetizers & Snacks",
  "book": "mountain",
  "contributor": "Mrs. Richard R. Meckfessel",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "7 cups",
      "item": "uncooked oats"
     },
     {
      "qty": "2 cups",
      "item": "coconut"
     },
     {
      "qty": "1 cup",
      "item": "wheat germ"
     },
     {
      "qty": "1 cup",
      "item": "sesame seeds"
     },
     {
      "qty": "1 cup",
      "item": "brown sugar"
     },
     {
      "qty": "1 cup",
      "item": "oil (peanut, corn or safflower)"
     },
     {
      "qty": "1 Tbsp.",
      "item": "vanilla"
     },
     {
      "qty": "1 tsp.",
      "item": "salt"
     },
     {
      "qty": "",
      "item": "slivered almonds or shelled sunflower seeds (optional)"
     }
    ]
   }
  ],
  "steps": [
   "Combine all ingredients.",
   "Roast in large, shallow pans at 200°F for 2 hours, stirring occasionally."
  ],
  "tips": [
   "Keep in covered jars or cans in a cool place, or refrigerate.",
   "Serve with milk as a dry cereal."
  ],
  "ovenTemp": "200°F",
  "cookTime": "2 hours",
  "yield": null,
  "editorNotes": [
   "Printed title: 'Granola - A Cereal'."
  ]
 },
 {
  "id": "rice-broccoli-casserole",
  "title": "Rice-Broccoli Casserole",
  "category": "Vegetables & Sides",
  "book": "mountain",
  "contributor": "Mrs. Thomas H. Edelblute, Jr.",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "2 cups",
      "item": "cooked rice (not instant)"
     },
     {
      "qty": "1 (10 oz.) pkg.",
      "item": "frozen chopped broccoli"
     },
     {
      "qty": "¼ cup",
      "item": "chopped onion"
     },
     {
      "qty": "½ cup",
      "item": "chopped celery"
     },
     {
      "qty": "3 Tbsp.",
      "item": "butter or margarine"
     },
     {
      "qty": "1 (10½ oz.) can",
      "item": "cream of chicken soup"
     },
     {
      "qty": "½ cup",
      "item": "milk"
     },
     {
      "qty": "1 (5 oz.) can",
      "item": "water chestnuts"
     },
     {
      "qty": "1 (8 oz.) jar",
      "item": "pasteurized process cheese spread, softened"
     }
    ]
   }
  ],
  "steps": [
   "Cook enough rice to yield 2 cups. Thaw broccoli and drain thoroughly.",
   "Sauté onion and celery in melted butter.",
   "Blend in soup, milk, water chestnuts, rice, broccoli and ⅓ of the cheese spread.",
   "Turn into a 10 x 7 x 2-inch glass baking dish.",
   "Soften the remaining cheese by setting the jar in hot water, then spread it over the top.",
   "Bake at 350°F for 40 minutes."
  ],
  "tips": [],
  "ovenTemp": "350°F",
  "cookTime": "40 minutes",
  "yield": "Serves 6",
  "editorNotes": [
   "Ingredient line cut off as 'water chest-'; read as water chestnuts. Draining/slicing not stated."
  ]
 },
 {
  "id": "ramp-soup",
  "title": "Ramp Soup",
  "category": "Soups",
  "book": "mountain",
  "contributor": "Mrs. William A. Pugh",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": "Soup",
    "items": [
     {
      "qty": "1 lb.",
      "item": "stew beef"
     },
     {
      "qty": "2 qts.",
      "item": "salted water"
     },
     {
      "qty": "18–20",
      "item": "ramps, diced"
     },
     {
      "qty": "4–5 stalks",
      "item": "celery, diced"
     },
     {
      "qty": "2–3",
      "item": "carrots, diced"
     },
     {
      "qty": "1 lb.",
      "item": "potatoes, diced"
     }
    ]
   },
   {
    "name": "Fried ramps",
    "items": [
     {
      "qty": "18–20",
      "item": "ramps"
     },
     {
      "qty": "2 Tbsp.",
      "item": "butter"
     },
     {
      "qty": "",
      "item": "salt and pepper to taste"
     }
    ]
   }
  ],
  "steps": [
   "Boil the beef in 2 quarts of salted water for about 15 minutes, skimming off any scum.",
   "Dice and add 18 to 20 ramps, the celery, carrots and potatoes. Simmer 2 to 3 hours.",
   "Fry another 18 to 20 ramps in butter for about 10 minutes, until thoroughly cooked.",
   "Add one large cup of the soup to the fried ramps with salt and pepper to taste. Simmer 10 to 15 minutes.",
   "Lift out the meat and serve it separately.",
   "Combine both mixtures, press through a colander, stir and reheat."
  ],
  "tips": [
   "Ramps can be canned or frozen for winter use."
  ],
  "ovenTemp": null,
  "cookTime": "2–3 hours",
  "yield": null,
  "editorNotes": [
   "Ingredient list prints '8 to 20 ramps' and '18 to 20 ramps'; the method uses 18–20 twice, so 18–20 is used for both (36–40 ramps total).",
   "The 2 quarts of water appear only in the method; added to the ingredient list."
  ]
 },
 {
  "id": "country-sweet-potatoes",
  "title": "Country Sweet Potatoes",
  "category": "Vegetables & Sides",
  "book": "mountain",
  "contributor": "Mrs. Richard R. Meckfessel",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "1 can (about 3½ cups)",
      "item": "sweet potatoes in heavy syrup"
     },
     {
      "qty": "3 Tbsp.",
      "item": "margarine or butter"
     },
     {
      "qty": "¼ cup",
      "item": "milk"
     },
     {
      "qty": "⅛ tsp.",
      "item": "salt"
     },
     {
      "qty": "2 Tbsp.",
      "item": "brown sugar or maple syrup"
     },
     {
      "qty": "⅓ cup",
      "item": "chopped pecans"
     },
     {
      "qty": "10 large",
      "item": "marshmallows, cut in half"
     }
    ]
   }
  ],
  "steps": [
   "Drain the syrup from the potatoes and mash them.",
   "Add milk, sugar, butter and salt; mix well. Fold in nuts.",
   "Spread in a shallow, greased baking dish and top with marshmallows.",
   "Heat at 375°F for 15 minutes, or until the marshmallows brown on top."
  ],
  "tips": [],
  "ovenTemp": "375°F",
  "cookTime": "15 minutes",
  "yield": "Serves 4",
  "editorNotes": [
   "Can size printed as '1(3½ cups) can sweet potatoes or in heavy syrup' — garbled; read as one can of about 3½ cups."
  ]
 },
 {
  "id": "sweet-potato-pudding",
  "title": "Sweet Potato Pudding",
  "category": "Vegetables & Sides",
  "book": "mountain",
  "contributor": "Mrs. Latelle M. LaFollette, III",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "2 cups",
      "item": "cooked sweet potatoes (or 1 large can)"
     },
     {
      "qty": "2",
      "item": "eggs, lightly beaten"
     },
     {
      "qty": "1 cup",
      "item": "brown sugar, packed"
     },
     {
      "qty": "1 cup",
      "item": "milk (or ¾ cup milk plus ¼ cup bourbon)"
     },
     {
      "qty": "¼ cup",
      "item": "melted butter"
     },
     {
      "qty": "1 tsp.",
      "item": "grated lemon rind"
     },
     {
      "qty": "2 tsp.",
      "item": "lemon juice"
     },
     {
      "qty": "¼ tsp.",
      "item": "ginger"
     },
     {
      "qty": "¼ tsp.",
      "item": "ground cloves"
     },
     {
      "qty": "½ tsp.",
      "item": "cinnamon"
     },
     {
      "qty": "½ tsp.",
      "item": "salt"
     },
     {
      "qty": "1 cup",
      "item": "coarsely chopped nuts"
     }
    ]
   }
  ],
  "steps": [
   "Put the sweet potatoes in a mixing bowl, add eggs and mix well.",
   "Gradually beat in the sugar.",
   "Stir in milk, butter, lemon rind and juice.",
   "Add ginger, cloves, cinnamon and salt; mix thoroughly. Add the nuts last.",
   "Pour into a greased baking dish that is not too deep.",
   "Bake at 350°F for 30 minutes, or until set."
  ],
  "tips": [],
  "ovenTemp": "350°F",
  "cookTime": "30 minutes",
  "yield": "Serves 6",
  "editorNotes": [
   "Ingredient printed as '1 cup coarsely chopped' with the noun missing; the method calls for 'nut meats', so nuts are assumed (kind not specified)."
  ]
 },
 {
  "id": "baked-acorn-squash-with-pineapple",
  "title": "Baked Acorn Squash with Pineapple",
  "category": "Vegetables & Sides",
  "book": "mountain",
  "contributor": "Mrs. John L. Sullivan",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "3 medium",
      "item": "acorn squash"
     },
     {
      "qty": "1 (8 oz.) can",
      "item": "crushed pineapple"
     },
     {
      "qty": "½ cup",
      "item": "brown sugar"
     },
     {
      "qty": "1 tsp.",
      "item": "mixed spices (cinnamon, nutmeg, allspice)"
     },
     {
      "qty": "¼ cup",
      "item": "chopped pecans"
     },
     {
      "qty": "2 Tbsp.",
      "item": "soft margarine"
     },
     {
      "qty": "½ cup",
      "item": "water"
     }
    ]
   }
  ],
  "steps": [
   "Cut squash in half lengthwise and remove the seeds. Place in a baking dish.",
   "Drain pineapple and combine with brown sugar, spices, pecans and margarine.",
   "Spoon the mixture into the cavity of each squash half.",
   "Pour the water into the bottom of the dish and cover.",
   "Bake at 375°F for 45 minutes. Uncover and bake 15 minutes longer, until slightly browned."
  ],
  "tips": [],
  "ovenTemp": "375°F",
  "cookTime": "1 hour",
  "yield": "Serves 6",
  "editorNotes": [
   "Pecans printed as '4 cup' — almost certainly ¼ cup (best guess used)."
  ]
 },
 {
  "id": "graham-nut-crust",
  "title": "Graham Nut Crust",
  "category": "Pies",
  "book": "mountain",
  "contributor": null,
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "1¾ cups",
      "item": "fine graham cracker crumbs"
     },
     {
      "qty": "½ tsp.",
      "item": "cinnamon"
     },
     {
      "qty": "½ cup",
      "item": "melted butter"
     },
     {
      "qty": "¼ cup",
      "item": "finely chopped walnuts"
     }
    ]
   }
  ],
  "steps": [
   "Mix all ingredients. Reserve 3 Tbsp. to decorate the top.",
   "Press the rest on the bottom and 2½ inches up the sides of a 9-inch springform pan."
  ],
  "tips": [],
  "ovenTemp": null,
  "cookTime": null,
  "yield": null,
  "editorNotes": [
   "Title printed 'Grahm Nut Crust'.",
   "No contributor, filling or baking instructions printed; this appears to be the crust for a cheesecake-style filling not included here."
  ]
 },
 {
  "id": "white-chocolate-cake",
  "title": "White Chocolate Cake",
  "category": "Cakes",
  "book": "mountain",
  "contributor": "Mrs. William E. Hamb",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "½ lb.",
      "item": "white chocolate"
     },
     {
      "qty": "1 cup",
      "item": "butter"
     },
     {
      "qty": "2 cups",
      "item": "sugar"
     },
     {
      "qty": "4",
      "item": "eggs, separated"
     },
     {
      "qty": "2½ cups",
      "item": "flour"
     },
     {
      "qty": "1 tsp.",
      "item": "baking powder"
     },
     {
      "qty": "½ tsp.",
      "item": "salt"
     },
     {
      "qty": "1 cup",
      "item": "buttermilk"
     },
     {
      "qty": "1 cup",
      "item": "chopped pecans"
     },
     {
      "qty": "1 cup",
      "item": "flaked coconut"
     },
     {
      "qty": "1 tsp.",
      "item": "vanilla"
     }
    ]
   }
  ],
  "steps": [
   "Melt chocolate over hot water.",
   "Cream butter and sugar. Add egg yolks and beat. Add the chocolate to the creamed mixture.",
   "Sift flour, baking powder and salt together. Add alternately with buttermilk.",
   "Add pecans, coconut and vanilla.",
   "Beat egg whites until stiff and fold into the batter.",
   "Pour into an ungreased tube pan. Bake at 325°F for 1 hour 10 minutes."
  ],
  "tips": [],
  "ovenTemp": "325°F",
  "cookTime": "1 hour 10 minutes",
  "yield": null,
  "editorNotes": [
   "OCR 'baking po' read as baking powder.",
   "Contributor surname printed 'Hamb' — may be truncated."
  ]
 },
 {
  "id": "carrot-cake",
  "title": "Carrot Cake",
  "category": "Cakes",
  "book": "mountain",
  "contributor": "Mrs. Charles G. Moyers, Jr.",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "2 cups",
      "item": "sugar"
     },
     {
      "qty": "1½ cups",
      "item": "cooking oil"
     },
     {
      "qty": "4",
      "item": "eggs"
     },
     {
      "qty": "3 cups",
      "item": "finely grated raw carrots"
     },
     {
      "qty": "1 tsp.",
      "item": "cinnamon, or more to taste"
     },
     {
      "qty": "1 tsp.",
      "item": "vanilla"
     },
     {
      "qty": "1 tsp.",
      "item": "black walnut flavoring"
     },
     {
      "qty": "2 cups",
      "item": "self-rising flour"
     },
     {
      "qty": "1 cup",
      "item": "chopped black walnuts or pecans"
     }
    ]
   },
   {
    "name": "Glaze",
    "items": [
     {
      "qty": "⅓ cup",
      "item": "buttermilk"
     },
     {
      "qty": "1 cup",
      "item": "sugar"
     },
     {
      "qty": "½ tsp.",
      "item": "baking soda"
     },
     {
      "qty": "1 tsp.",
      "item": "light corn syrup"
     }
    ]
   }
  ],
  "steps": [
   "By hand, mix sugar, oil and eggs.",
   "Add carrots, cinnamon, vanilla and walnut flavoring, flour and nuts.",
   "Pour into a lightly greased tube or Bundt pan. Set a cookie sheet under the cake while it bakes.",
   "Bake at 350°F for 1½ hours.",
   "For the glaze: mix all glaze ingredients and bring to a boil. Spoon over the hot cake."
  ],
  "tips": [
   "Leave out the black walnut flavoring if you are not using black walnuts.",
   "If not using self-rising flour, add 2 tsp. soda and 1 tsp. salt."
  ],
  "ovenTemp": "350°F",
  "cookTime": "1½ hours",
  "yield": null,
  "editorNotes": [
   "OCR 'undt pan' read as Bundt pan.",
   "The all-purpose flour substitution (2 tsp. soda) is as printed; a standard self-rising conversion uses baking powder, so test before relying on it."
  ]
 },
 {
  "id": "danish-christmas-cake",
  "title": "Danish Christmas Cake",
  "category": "Cakes",
  "book": "mountain",
  "contributor": "Mrs. E. Garfield Atkins",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "1 cup",
      "item": "shortening"
     },
     {
      "qty": "1⅓ cups",
      "item": "sugar"
     },
     {
      "qty": "3",
      "item": "eggs"
     },
     {
      "qty": "3 cups",
      "item": "sifted flour"
     },
     {
      "qty": "1½ tsp.",
      "item": "soda"
     },
     {
      "qty": "1 tsp.",
      "item": "salt"
     },
     {
      "qty": "1 Tbsp.",
      "item": "orange juice"
     },
     {
      "qty": "1 lb.",
      "item": "dates, chopped"
     },
     {
      "qty": "2 cups",
      "item": "chopped nuts"
     },
     {
      "qty": "1 (10 oz.) bottle",
      "item": "maraschino cherries, chopped"
     },
     {
      "qty": "1 Tbsp.",
      "item": "grated orange rind"
     },
     {
      "qty": "1 cup",
      "item": "buttermilk"
     }
    ]
   },
   {
    "name": "Sauce",
    "items": [
     {
      "qty": "1 cup",
      "item": "sugar"
     },
     {
      "qty": "1 cup",
      "item": "orange juice"
     },
     {
      "qty": "1",
      "item": "orange rind, grated"
     },
     {
      "qty": "1 cup",
      "item": "coconut"
     }
    ]
   },
   {
    "name": "Also needed",
    "items": [
     {
      "qty": "",
      "item": "extra coconut, for the top"
     }
    ]
   }
  ],
  "steps": [
   "Combine shortening, sugar and eggs.",
   "Sift soda, salt and flour together and add to the shortening mixture. Add orange juice.",
   "Fold in the remaining ingredients.",
   "Bake in one large, well-greased tube pan at 325°F for 1 hour 20 minutes, or in 2 loaf pans for 60 to 70 minutes.",
   "While the cake bakes, make the sauce: heat sugar and orange juice, add grated rind and coconut, mix well, remove from heat and let cool.",
   "Pour the sauce over the hot cake and add extra coconut on top.",
   "Let the cake cool in the pan about 30 minutes, then turn out onto foil, seal tightly and keep in the refrigerator or freezer."
  ],
  "tips": [],
  "ovenTemp": "325°F",
  "cookTime": "1 hour 20 minutes (tube pan); 60–70 minutes (loaf pans)",
  "yield": null,
  "editorNotes": [
   "Buttermilk is never mentioned in the method; it is presumably among the 'remaining ingredients' folded in at the end."
  ]
 },
 {
  "id": "broiled-orange-cake",
  "title": "Broiled Orange Cake",
  "category": "Cakes",
  "book": "mountain",
  "contributor": "Mrs. T. A. Galyean",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "1 stick",
      "item": "butter or margarine"
     },
     {
      "qty": "1 cup",
      "item": "sugar"
     },
     {
      "qty": "1",
      "item": "egg"
     },
     {
      "qty": "2 cups",
      "item": "sifted flour"
     },
     {
      "qty": "1 tsp.",
      "item": "soda"
     },
     {
      "qty": "¼ tsp.",
      "item": "salt"
     },
     {
      "qty": "1 cup",
      "item": "buttermilk"
     },
     {
      "qty": "1 cup",
      "item": "ground white (golden) raisins"
     },
     {
      "qty": "1",
      "item": "orange rind, grated"
     },
     {
      "qty": "½ cup",
      "item": "chopped nuts (optional)"
     }
    ]
   },
   {
    "name": "Topping",
    "items": [
     {
      "qty": "",
      "item": "juice of 1 orange"
     },
     {
      "qty": "",
      "item": "juice of 1 lemon"
     },
     {
      "qty": "1 cup",
      "item": "sugar"
     },
     {
      "qty": "1 Tbsp.",
      "item": "melted butter"
     },
     {
      "qty": "",
      "item": "whipped cream, for garnish"
     }
    ]
   }
  ],
  "steps": [
   "Cream butter, add sugar and blend. Add the unbeaten egg and beat well.",
   "Sift dry ingredients together and add alternately with buttermilk.",
   "Blend in raisins, orange rind and nuts, if using.",
   "Pour into an 8 x 11 x 2-inch pan. Put it in a cold oven set to 325°F.",
   "Bake until well done, about 1 hour, when a toothpick comes out clean.",
   "For the topping: combine orange and lemon juices with sugar and melted butter. Pour over the cake.",
   "Place under the broiler until the topping browns slightly. Watch carefully so it doesn't burn."
  ],
  "tips": [
   "Serve warm or cold with whipped cream.",
   "Keep the cake in its pan to hold moisture."
  ],
  "ovenTemp": "325°F (cold start)",
  "cookTime": "about 1 hour",
  "yield": null,
  "editorNotes": []
 },
 {
  "id": "cranberry-cake",
  "title": "Cranberry Cake",
  "category": "Cakes",
  "book": "mountain",
  "contributor": "Mrs. William H. Knight",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "2½ cups",
      "item": "flour"
     },
     {
      "qty": "1 cup",
      "item": "sugar"
     },
     {
      "qty": "1 tsp.",
      "item": "salt"
     },
     {
      "qty": "1 tsp.",
      "item": "soda"
     },
     {
      "qty": "1 tsp.",
      "item": "baking powder"
     },
     {
      "qty": "1 cup",
      "item": "chopped pecans"
     },
     {
      "qty": "1 cup",
      "item": "chopped dates"
     },
     {
      "qty": "2 cups",
      "item": "whole cranberries"
     },
     {
      "qty": "",
      "item": "grated rind of 2 oranges"
     },
     {
      "qty": "2",
      "item": "eggs, beaten"
     },
     {
      "qty": "1 cup",
      "item": "buttermilk"
     },
     {
      "qty": "¾ cup",
      "item": "cooking oil"
     }
    ]
   },
   {
    "name": "Glaze",
    "items": [
     {
      "qty": "¾ cup",
      "item": "orange juice"
     },
     {
      "qty": "¾ cup",
      "item": "sugar"
     }
    ]
   },
   {
    "name": "Also needed",
    "items": [
     {
      "qty": "",
      "item": "whipped cream, for garnish"
     }
    ]
   }
  ],
  "steps": [
   "Sift the flour and measure; sift again with sugar, salt, soda and baking powder.",
   "Stir in nuts, dates, cranberries and orange rind.",
   "Combine beaten eggs with buttermilk and oil; add to the fruit mixture.",
   "Bake in a well-greased tube pan at 325°F for 1 hour.",
   "For the glaze: heat juice and sugar until the sugar dissolves; do not boil.",
   "Pour over the hot cake and let stand 30 minutes. Remove from the pan and cool."
  ],
  "tips": [
   "A good ending for a Christmas or Thanksgiving dinner.",
   "Serve with whipped cream."
  ],
  "ovenTemp": "325°F",
  "cookTime": "1 hour",
  "yield": "Serves 12",
  "editorNotes": [
   "The method paragraph is printed twice in the source; included once."
  ]
 },
 {
  "id": "fig-cake",
  "title": "Fig Cake",
  "category": "Cakes",
  "book": "mountain",
  "contributor": "Mrs. Melville Hyatt",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "2 cups",
      "item": "sugar"
     },
     {
      "qty": "¾ cup",
      "item": "butter"
     },
     {
      "qty": "4",
      "item": "eggs"
     },
     {
      "qty": "3 cups",
      "item": "flour"
     },
     {
      "qty": "½ tsp.",
      "item": "salt"
     },
     {
      "qty": "1 tsp.",
      "item": "cinnamon"
     },
     {
      "qty": "1 tsp.",
      "item": "allspice"
     },
     {
      "qty": "1 tsp.",
      "item": "soda"
     },
     {
      "qty": "1 cup",
      "item": "buttermilk"
     },
     {
      "qty": "1 pint jar",
      "item": "figs, with their liquid"
     },
     {
      "qty": "1 cup",
      "item": "chopped nuts"
     },
     {
      "qty": "1 tsp.",
      "item": "vanilla"
     }
    ]
   }
  ],
  "steps": [
   "Cream sugar with butter. Add eggs one at a time, beating well after each.",
   "Sift flour, salt, cinnamon and allspice together. Stir the soda into the buttermilk.",
   "Add flour and buttermilk alternately to the butter mixture.",
   "Chop the figs with their liquid in a blender and add to the batter, combining thoroughly.",
   "Add nuts and vanilla and mix well.",
   "Bake at 325°F for 75 to 90 minutes. Do not open the oven door before 75 minutes."
  ],
  "tips": [],
  "ovenTemp": "325°F",
  "cookTime": "75–90 minutes",
  "yield": null,
  "editorNotes": [
   "Pan type and size not stated.",
   "'1 pint jar of figs' — presumably home-preserved figs in syrup."
  ]
 },
 {
  "id": "date-cake",
  "title": "Date Cake",
  "category": "Cakes",
  "book": "mountain",
  "contributor": null,
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "1 (8 oz.) pkg.",
      "item": "dates"
     },
     {
      "qty": "1 tsp.",
      "item": "soda"
     },
     {
      "qty": "1 cup",
      "item": "boiling water"
     },
     {
      "qty": "1 Tbsp.",
      "item": "vegetable shortening or margarine"
     },
     {
      "qty": "1 cup",
      "item": "sugar"
     },
     {
      "qty": "1",
      "item": "egg"
     },
     {
      "qty": "½ cup",
      "item": "chopped walnuts"
     },
     {
      "qty": "1 tsp.",
      "item": "vanilla"
     },
     {
      "qty": "1½ cups",
      "item": "flour"
     },
     {
      "qty": "¼ tsp.",
      "item": "salt"
     }
    ]
   }
  ],
  "steps": [
   "Pit the dates and cut into small pieces. Sprinkle with soda, cover with the boiling water and let cool.",
   "Cream shortening and sugar. Add egg, walnuts and vanilla, and beat.",
   "Add the date mixture and mix well.",
   "Add the flour sifted with the salt.",
   "Bake in a 9 x 5-inch loaf pan at 325°F for 45 to 50 minutes."
  ],
  "tips": [],
  "ovenTemp": "325°F",
  "cookTime": "45–50 minutes",
  "yield": null,
  "editorNotes": [
   "No contributor printed."
  ]
 },
 {
  "id": "prune-cake-2",
  "title": "Prune Cake",
  "category": "Cakes",
  "book": "mountain",
  "contributor": null,
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "1½ cups",
      "item": "sugar"
     },
     {
      "qty": "1 cup",
      "item": "cooking oil"
     },
     {
      "qty": "3",
      "item": "eggs, beaten"
     },
     {
      "qty": "2 cups",
      "item": "flour"
     },
     {
      "qty": "1 tsp.",
      "item": "soda"
     },
     {
      "qty": "1 tsp.",
      "item": "cinnamon"
     },
     {
      "qty": "1 tsp.",
      "item": "nutmeg"
     },
     {
      "qty": "1 tsp.",
      "item": "allspice"
     },
     {
      "qty": "",
      "item": "salt"
     },
     {
      "qty": "1 cup",
      "item": "sour milk"
     },
     {
      "qty": "1 cup",
      "item": "chopped nuts"
     },
     {
      "qty": "1 cup",
      "item": "cooked prunes, pitted and finely chopped"
     },
     {
      "qty": "1 tsp.",
      "item": "vanilla"
     }
    ]
   },
   {
    "name": "Sauce",
    "items": [
     {
      "qty": "1 cup",
      "item": "sugar"
     },
     {
      "qty": "½ cup",
      "item": "buttermilk"
     },
     {
      "qty": "½ tsp.",
      "item": "soda"
     },
     {
      "qty": "2 tsp.",
      "item": "vanilla"
     },
     {
      "qty": "¼–½ cup",
      "item": "butter"
     }
    ]
   }
  ],
  "steps": [
   "Blend sugar and oil. Add beaten eggs and beat well.",
   "Sift the dry ingredients together three times. Add alternately with sour milk, beating well after each addition.",
   "Stir in nuts, prunes and vanilla until evenly distributed.",
   "Pour into a buttered 9 x 13 x 2-inch pan and bake at 300°F for 1 hour.",
   "While the cake bakes, make the sauce: combine all sauce ingredients in a saucepan and boil 1 minute without beating.",
   "Pour the sauce over the cake immediately, while it is still hot. Leave the cake in the pan."
  ],
  "tips": [],
  "ovenTemp": "300°F",
  "cookTime": "1 hour",
  "yield": null,
  "editorNotes": [
   "Salt quantity missing ('1 teaspoon allspice teaspoon salt').",
   "Sauce soda printed '/2 teaspoon'; read as ½ tsp.",
   "No contributor printed."
  ]
 },
 {
  "id": "black-walnut-cake",
  "title": "Black Walnut Cake",
  "category": "Cakes",
  "book": "mountain",
  "contributor": "Mrs. Ancil B. Cutlip",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "1 cup",
      "item": "shortening"
     },
     {
      "qty": "2 cups",
      "item": "sugar"
     },
     {
      "qty": "4",
      "item": "eggs, separated"
     },
     {
      "qty": "3 cups",
      "item": "sifted cake flour"
     },
     {
      "qty": "3 tsp.",
      "item": "baking powder"
     },
     {
      "qty": "¼ tsp.",
      "item": "salt"
     },
     {
      "qty": "1 cup",
      "item": "milk"
     },
     {
      "qty": "1 tsp.",
      "item": "vanilla"
     },
     {
      "qty": "1 cup",
      "item": "ground black walnuts or hickory nuts"
     }
    ]
   },
   {
    "name": "Glaze",
    "items": [
     {
      "qty": "3 Tbsp.",
      "item": "white corn syrup"
     },
     {
      "qty": "3 Tbsp.",
      "item": "margarine"
     }
    ]
   }
  ],
  "steps": [
   "Cream shortening and sugar until light and fluffy.",
   "Add egg yolks one at a time, beating thoroughly after each.",
   "Sift dry ingredients together. Add alternately with milk and vanilla, beating smooth after each addition.",
   "Fold in nuts, then the stiffly beaten egg whites.",
   "Pour into a greased and floured 10-inch tube or Bundt pan. Bake at 350°F for 60 minutes, or until done.",
   "Turn out onto a wire rack.",
   "For the glaze: boil corn syrup and margarine in a small saucepan, then drizzle over the hot cake."
  ],
  "tips": [],
  "ovenTemp": "350°F",
  "cookTime": "60 minutes",
  "yield": null,
  "editorNotes": [
   "Printed title: 'Black Walnut Cake (or Hickory Nut)'.",
   "Glaze boiling time is missing ('boil ___ minutes')."
  ]
 },
 {
  "id": "hickory-nut-cake",
  "title": "Hickory Nut Cake",
  "category": "Cakes",
  "book": "mountain",
  "contributor": "Mrs. Richard Currence",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "1 cup",
      "item": "butter"
     },
     {
      "qty": "2 cups",
      "item": "sugar"
     },
     {
      "qty": "4",
      "item": "eggs"
     },
     {
      "qty": "3 cups",
      "item": "flour, sifted before measuring"
     },
     {
      "qty": "3¼ tsp.",
      "item": "baking powder"
     },
     {
      "qty": "",
      "item": "pinch of salt"
     },
     {
      "qty": "1 cup",
      "item": "milk"
     },
     {
      "qty": "2 cups",
      "item": "broken hickory nuts"
     }
    ]
   }
  ],
  "steps": [
   "Cream butter and sugar. Add eggs and beat.",
   "Sift flour before measuring, then sift flour, baking powder and salt together.",
   "Add dry ingredients alternately with milk. Stir in nuts.",
   "Bake in a greased tube pan at 350°F about 1 hour. Do not let the crust brown too much.",
   "Cake is done when a toothpick comes out clean."
  ],
  "tips": [],
  "ovenTemp": "350°F",
  "cookTime": "about 1 hour",
  "yield": null,
  "editorNotes": [
   "Pan size not stated."
  ]
 },
 {
  "id": "rainbow-sherbet-cake",
  "title": "Rainbow Sherbet Cake",
  "category": "Desserts",
  "book": "mountain",
  "contributor": "Mrs. Joseph Wright",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "½ gallon",
      "item": "vanilla ice cream"
     },
     {
      "qty": "½ cup",
      "item": "chopped nuts"
     },
     {
      "qty": "½ cup",
      "item": "chocolate chips (mini chips work best)"
     },
     {
      "qty": "1 quart each",
      "item": "lime, orange and raspberry sherbet"
     },
     {
      "qty": "1 pint",
      "item": "whipping cream"
     },
     {
      "qty": "⅓ cup",
      "item": "powdered sugar"
     },
     {
      "qty": "",
      "item": "green food coloring"
     },
     {
      "qty": "",
      "item": "fresh strawberries, for garnish"
     }
    ]
   }
  ],
  "steps": [
   "Soften the vanilla ice cream and stir in nuts and chocolate chips.",
   "Put half of this mixture in an angel food cake pan.",
   "Add alternating scoops of the sherbets until all are used or the pan is nearly full. Top with the other half of the ice cream mixture.",
   "Freeze at least 24 hours.",
   "Shortly before serving, whip the cream, sweeten with powdered sugar and tint pale green.",
   "Dip the pan in hot water up to the rim and run a knife around the edges. Invert onto a large chilled serving plate.",
   "Frost with the whipped cream and garnish with fresh strawberries, stems left on."
  ],
  "tips": [
   "Good with coconut macaroons and lemonade, or coffee and tea."
  ],
  "ovenTemp": null,
  "cookTime": "Freeze at least 24 hours",
  "yield": "Serves 20 to 24",
  "editorNotes": []
 },
 {
  "id": "apple-butter-spice-cake",
  "title": "Apple Butter Spice Cake",
  "category": "Cakes",
  "book": "mountain",
  "contributor": null,
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": "Cake",
    "items": [
     {
      "qty": "2¼ cups",
      "item": "sifted flour"
     },
     {
      "qty": "1 tsp.",
      "item": "baking powder"
     },
     {
      "qty": "1 tsp.",
      "item": "baking soda"
     },
     {
      "qty": "½ tsp.",
      "item": "salt"
     },
     {
      "qty": "1 cup",
      "item": "sugar"
     },
     {
      "qty": "½ cup",
      "item": "butter"
     },
     {
      "qty": "2",
      "item": "eggs"
     },
     {
      "qty": "¾ cup",
      "item": "apple butter"
     },
     {
      "qty": "1 tsp.",
      "item": "vanilla extract"
     },
     {
      "qty": "1 cup",
      "item": "sour cream"
     }
    ]
   },
   {
    "name": "Topping and Filling",
    "items": [
     {
      "qty": "½ cup",
      "item": "firmly packed brown sugar"
     },
     {
      "qty": "1 tsp.",
      "item": "cinnamon"
     },
     {
      "qty": "½ tsp.",
      "item": "nutmeg"
     },
     {
      "qty": "½ cup",
      "item": "chopped nuts"
     },
     {
      "qty": "",
      "item": "Whipped cream for garnish (optional)"
     }
    ]
   }
  ],
  "steps": [
   "Grease and flour the bottom of a 13\" × 9\" pan.",
   "Sift flour with baking powder, soda and salt.",
   "In a large mixing bowl, gradually add sugar to butter; cream at high speed until light and fluffy.",
   "At medium speed, add eggs, beating well after each addition.",
   "Blend in apple butter and vanilla extract.",
   "At low speed, add the sifted dry ingredients alternately with the sour cream, beginning and ending with dry ingredients. Blend well after each addition.",
   "Combine the topping ingredients.",
   "Pour half the batter into the pan and sprinkle with half the topping mixture.",
   "Spoon in the remaining batter, spread evenly, and sprinkle with the remaining topping.",
   "Bake at 350°F for 40 to 45 minutes, until the cake springs back when lightly touched in the center."
  ],
  "tips": [
   "Serve warm or cold with whipped cream, if desired."
  ],
  "ovenTemp": "350°F",
  "cookTime": "40–45 minutes",
  "yield": null,
  "editorNotes": [
   "No contributor or location printed.",
   "Whipped cream is listed with the topping but is only a garnish, not mixed into it."
  ]
 },
 {
  "id": "italian-cream-cake",
  "title": "Italian Cream Cake",
  "category": "Cakes",
  "book": "mountain",
  "contributor": "Mrs. V. Courtlandt Smith, II",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": "Cake",
    "items": [
     {
      "qty": "½ cup",
      "item": "margarine"
     },
     {
      "qty": "½ cup",
      "item": "cooking oil"
     },
     {
      "qty": "2 cups",
      "item": "sugar"
     },
     {
      "qty": "5",
      "item": "egg yolks"
     },
     {
      "qty": "2 cups",
      "item": "sifted flour"
     },
     {
      "qty": "1 cup",
      "item": "buttermilk"
     },
     {
      "qty": "1 tsp.",
      "item": "vanilla"
     },
     {
      "qty": "1 cup",
      "item": "coconut"
     },
     {
      "qty": "1 cup",
      "item": "chopped pecans"
     },
     {
      "qty": "5",
      "item": "egg whites, beaten stiff"
     }
    ]
   },
   {
    "name": "Frosting",
    "items": [
     {
      "qty": "¼ cup",
      "item": "margarine"
     },
     {
      "qty": "1 lb.",
      "item": "powdered sugar"
     },
     {
      "qty": "1 (8 oz.) pkg.",
      "item": "cream cheese"
     },
     {
      "qty": "1 tsp.",
      "item": "vanilla"
     }
    ]
   }
  ],
  "steps": [
   "Blend margarine and oil in a mixer.",
   "Add sugar, then egg yolks one at a time, until creamy.",
   "Add flour alternately with buttermilk.",
   "Add vanilla, coconut and pecans.",
   "Slowly fold in the beaten egg whites.",
   "Bake in a greased and floured 9\" × 13\" pan at 350°F for 30 to 35 minutes, until done.",
   "For the frosting, blend margarine and cream cheese, then add powdered sugar and vanilla.",
   "Frost the cake and refrigerate."
  ],
  "tips": [],
  "ovenTemp": "350°F",
  "cookTime": "30–35 minutes",
  "yield": null,
  "editorNotes": [
   "No location printed.",
   "No leavening listed; source has none, so the cake relies on the beaten egg whites."
  ]
 },
 {
  "id": "black-walnut-pound-cake",
  "title": "Black Walnut Pound Cake",
  "category": "Cakes",
  "book": "mountain",
  "contributor": "Mrs. Ronald A. McKenney",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "¾ lb.",
      "item": "butter, softened"
     },
     {
      "qty": "1 lb. (4 cups)",
      "item": "flour"
     },
     {
      "qty": "1 lb. box",
      "item": "powdered sugar"
     },
     {
      "qty": "½ cup",
      "item": "water"
     },
     {
      "qty": "2 tsp.",
      "item": "vanilla"
     },
     {
      "qty": "6",
      "item": "eggs"
     },
     {
      "qty": "4 oz.",
      "item": "black walnuts, chopped"
     }
    ]
   }
  ],
  "steps": [
   "Grease and lightly flour a 9\" tube pan.",
   "Cream butter until light and fluffy, then gradually add the sugar.",
   "Add eggs one at a time, beating until light and creamy.",
   "Add flour alternately with the water and vanilla, beating until smooth and light.",
   "Fold in walnuts.",
   "Pour into the pan and bake at 350°F for 1 hour, or until a tester comes out clean."
  ],
  "tips": [
   "Do not over-bake, or the cake will be dry."
  ],
  "ovenTemp": "350°F",
  "cookTime": "1 hour",
  "yield": "Serves 12 to 16",
  "editorNotes": []
 },
 {
  "id": "hungarian-almond-torte",
  "title": "Hungarian Almond Torte",
  "category": "Cakes",
  "book": "mountain",
  "contributor": "Mrs. Charles A. Gray",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "7",
      "item": "eggs, separated"
     },
     {
      "qty": "⅔ cup",
      "item": "sugar"
     },
     {
      "qty": "½ lb.",
      "item": "ground almonds (if possible, half with skins and half without)"
     },
     {
      "qty": "5 Tbsp.",
      "item": "ground dry bread crumbs"
     },
     {
      "qty": "1 tsp.",
      "item": "almond extract"
     },
     {
      "qty": "1 pint",
      "item": "whipping cream (sweeten to taste, if desired)"
     }
    ]
   }
  ],
  "steps": [
   "Grease the bottoms of two 9\" cake pans.",
   "Beat the egg yolks; add the sugar and beat well.",
   "Add the almonds, crumbs and almond extract.",
   "Beat the egg whites until stiff and fold into the mixture.",
   "Pour into the pans and bake at 350°F for 25 to 30 minutes.",
   "Cool in the pans for 10 minutes, then remove.",
   "When cool, slice each layer horizontally if you prefer a four-layer torte.",
   "Whip the cream and stack the layers with whipped cream between them and on top."
  ],
  "tips": [
   "This torte may be made early in the day before serving."
  ],
  "ovenTemp": "350°F",
  "cookTime": "25–30 minutes",
  "yield": null,
  "editorNotes": [
   "Source lists the cream but does not say to whip it; 'whipped cream' in the method implies it."
  ]
 },
 {
  "id": "orchard-mince-pie",
  "title": "Orchard Mince Pie",
  "category": "Pies",
  "book": "mountain",
  "contributor": "Mrs. Frederick H. Morgan",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "1",
      "item": "unbaked 9\" pie shell"
     },
     {
      "qty": "¾ cup",
      "item": "light cream"
     },
     {
      "qty": "2 cups (2 to 3 medium)",
      "item": "apples, peeled and finely chopped"
     },
     {
      "qty": "¾ cup",
      "item": "firmly packed brown sugar"
     },
     {
      "qty": "1 cup",
      "item": "prepared mincemeat"
     },
     {
      "qty": "¼ tsp.",
      "item": "salt"
     },
     {
      "qty": "½ cup",
      "item": "chopped nuts"
     }
    ]
   }
  ],
  "steps": [
   "In a large mixing bowl, combine apples, mincemeat, cream, brown sugar and salt. Blend well.",
   "Pour into the unbaked pastry shell and sprinkle with nuts.",
   "Bake at 375°F for 40 to 50 minutes, until the crust is golden brown."
  ],
  "tips": [],
  "ovenTemp": "375°F",
  "cookTime": "40–50 minutes",
  "yield": null,
  "editorNotes": []
 },
 {
  "id": "pecan-pie",
  "title": "Pecan Pie",
  "category": "Pies",
  "book": "mountain",
  "contributor": "Mrs. Estil Monk",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "3 Tbsp.",
      "item": "butter"
     },
     {
      "qty": "⅔ cup",
      "item": "light brown sugar, packed"
     },
     {
      "qty": "¼ tsp.",
      "item": "salt"
     },
     {
      "qty": "3",
      "item": "eggs"
     },
     {
      "qty": "¾ cup",
      "item": "light corn syrup"
     },
     {
      "qty": "½ cup",
      "item": "cream"
     },
     {
      "qty": "¾ tsp.",
      "item": "vanilla"
     },
     {
      "qty": "1 cup",
      "item": "chopped pecans or pecan halves"
     },
     {
      "qty": "1",
      "item": "unbaked pie shell"
     }
    ]
   }
  ],
  "steps": [
   "Cream butter; beat in sugar and salt.",
   "Add eggs one at a time, beating briskly after each.",
   "Add the corn syrup, cream and vanilla and blend the whole mixture.",
   "Pour into the pie shell and bake 10 minutes at 450°F.",
   "Remove from the oven and cover the top with pecans.",
   "Reduce heat to 350°F and bake until the custard sets, about 30 minutes."
  ],
  "tips": [
   "If the nuts begin to brown too much, cover the pie with foil and continue baking."
  ],
  "ovenTemp": "450°F, then 350°F",
  "cookTime": "About 40 minutes",
  "yield": null,
  "editorNotes": [
   "No location printed.",
   "'Add remaining ingredients' is read as corn syrup, cream and vanilla, since the method adds the pecans separately after 10 minutes."
  ]
 },
 {
  "id": "meringue-pecan-pie",
  "title": "Meringue Pecan Pie",
  "category": "Pies",
  "book": "mountain",
  "contributor": "Mrs. Thomas H. Edelblute, Jr.",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "3",
      "item": "egg whites"
     },
     {
      "qty": "1 tsp.",
      "item": "vanilla"
     },
     {
      "qty": "1 cup",
      "item": "sugar"
     },
     {
      "qty": "20",
      "item": "Ritz crackers"
     },
     {
      "qty": "½ tsp.",
      "item": "baking powder"
     },
     {
      "qty": "½ cup",
      "item": "chopped pecans"
     }
    ]
   },
   {
    "name": "For serving",
    "items": [
     {
      "qty": "",
      "item": "Ice cream, or fresh fruit and whipped cream (optional)"
     }
    ]
   }
  ],
  "steps": [
   "Beat egg whites until very stiff; slowly add sugar, baking powder and vanilla.",
   "Break the crackers into pea-size pieces and stir them into the meringue by hand.",
   "Add the pecans.",
   "Pour into a well-buttered 9\" pie pan, buttering the edge and rim too.",
   "Bake at 350°F for 25 minutes."
  ],
  "tips": [
   "Serve with ice cream, or fresh fruit and whipped cream."
  ],
  "ovenTemp": "350°F",
  "cookTime": "25 minutes",
  "yield": "Serves 5 to 6",
  "editorNotes": []
 },
 {
  "id": "nutty-pumpkin-nog-pie",
  "title": "Nutty Pumpkin Nog Pie",
  "category": "Pies",
  "book": "mountain",
  "contributor": "Mrs. Bert Bradford, III",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": "Crust",
    "items": [
     {
      "qty": "1 cup",
      "item": "graham cracker crumbs"
     },
     {
      "qty": "½ cup",
      "item": "very finely chopped pecans"
     },
     {
      "qty": "3 Tbsp.",
      "item": "sugar"
     },
     {
      "qty": "6 Tbsp.",
      "item": "butter or margarine, melted"
     }
    ]
   },
   {
    "name": "Filling",
    "items": [
     {
      "qty": "1 envelope",
      "item": "unflavored gelatin"
     },
     {
      "qty": "½ cup",
      "item": "brown sugar"
     },
     {
      "qty": "½ tsp.",
      "item": "salt"
     },
     {
      "qty": "½ tsp.",
      "item": "ground cinnamon"
     },
     {
      "qty": "¼ tsp.",
      "item": "ground ginger"
     },
     {
      "qty": "Dash",
      "item": "ground nutmeg"
     },
     {
      "qty": "1 cup",
      "item": "dairy eggnog"
     },
     {
      "qty": "3",
      "item": "eggs, separated"
     },
     {
      "qty": "1 cup",
      "item": "canned pumpkin"
     },
     {
      "qty": "¼ cup",
      "item": "granulated sugar"
     }
    ]
   },
   {
    "name": "Garnish",
    "items": [
     {
      "qty": "",
      "item": "Whipped cream"
     },
     {
      "qty": "",
      "item": "Pecan halves"
     }
    ]
   }
  ],
  "steps": [
   "For the crust, combine cracker crumbs, pecans, sugar and melted butter in a small bowl.",
   "Press firmly into a 9\" pie plate.",
   "Bake at 375°F for 6 to 8 minutes. Remove and cool.",
   "For the filling, combine gelatin, brown sugar, salt, cinnamon, ginger and nutmeg in a saucepan.",
   "Stir in the eggnog, beaten egg yolks and pumpkin.",
   "Cook and stir over medium heat until the gelatin dissolves and the mixture thickens slightly. Remove from heat.",
   "Chill until partially set.",
   "Beat the egg whites until soft peaks form, then gradually add the granulated sugar, beating until stiff peaks form.",
   "Fold the whites into the pumpkin mixture and pile into the crust.",
   "Chill until firm, at least 4 hours."
  ],
  "tips": [
   "Garnish with whipped cream and pecan halves."
  ],
  "ovenTemp": "375°F (crust)",
  "cookTime": "6–8 minutes (crust); chill at least 4 hours",
  "yield": null,
  "editorNotes": [
   "The crust method is scrambled by OCR ('Bake at 375° for 6 to 8 dcool. and butter... B minutes'); reconstructed as: combine crumbs, pecans, sugar and butter, press into plate, bake 6–8 minutes, cool.",
   "Filling uses raw-ish egg whites folded in uncooked, as in the original."
  ]
 },
 {
  "id": "blondies",
  "title": "Blondies",
  "category": "Cookies & Bars",
  "book": "mountain",
  "contributor": "Mrs. George V. Hamrick",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "½ cup",
      "item": "margarine"
     },
     {
      "qty": "½ cup",
      "item": "dark brown sugar, firmly packed"
     },
     {
      "qty": "½ cup",
      "item": "granulated sugar"
     },
     {
      "qty": "2",
      "item": "eggs"
     },
     {
      "qty": "1 cup",
      "item": "flour"
     },
     {
      "qty": "¼ tsp.",
      "item": "salt"
     },
     {
      "qty": "½ tsp.",
      "item": "baking powder"
     },
     {
      "qty": "½ cup",
      "item": "chopped nut meats"
     },
     {
      "qty": "½ tsp.",
      "item": "vanilla"
     },
     {
      "qty": "",
      "item": "Powdered sugar, for dusting"
     }
    ]
   }
  ],
  "steps": [
   "Thoroughly cream margarine with brown sugar and granulated sugar.",
   "Add eggs and beat well.",
   "Sift together flour, salt and baking powder; mix into the creamed mixture.",
   "Stir in nuts and vanilla.",
   "Spoon into a greased 8\" square pan.",
   "Bake at 350°F for 30 to 35 minutes.",
   "Cut into squares and sprinkle with powdered sugar."
  ],
  "tips": [],
  "ovenTemp": "350°F",
  "cookTime": "30–35 minutes",
  "yield": null,
  "editorNotes": []
 },
 {
  "id": "iced-brownies",
  "title": "Iced Brownies",
  "category": "Cookies & Bars",
  "book": "mountain",
  "contributor": "Mrs. Charles B. Gates, Jr.",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": "Brownies",
    "items": [
     {
      "qty": "½ cup",
      "item": "margarine or butter"
     },
     {
      "qty": "1 cup",
      "item": "sugar"
     },
     {
      "qty": "1 (16 oz.) can",
      "item": "chocolate syrup"
     },
     {
      "qty": "4",
      "item": "eggs"
     },
     {
      "qty": "1 cup",
      "item": "flour"
     },
     {
      "qty": "1 cup",
      "item": "chopped nuts"
     }
    ]
   },
   {
    "name": "Topping",
    "items": [
     {
      "qty": "1 cup",
      "item": "margarine"
     },
     {
      "qty": "2 cups",
      "item": "sugar"
     },
     {
      "qty": "⅓ cup",
      "item": "evaporated milk"
     },
     {
      "qty": "½ cup",
      "item": "chocolate chips"
     },
     {
      "qty": "1 tsp.",
      "item": "vanilla"
     }
    ]
   }
  ],
  "steps": [
   "Cream butter and sugar well. Slowly add the syrup.",
   "Add eggs one at a time, beating well after each.",
   "Add flour, then the chopped nuts.",
   "Bake in a well-greased 9\" × 13\" pan at 350°F for 25 minutes. Cool.",
   "For the topping, bring margarine, sugar and evaporated milk to a boil and boil 3 minutes.",
   "Remove from heat, add chocolate chips and stir until melted.",
   "Add vanilla and spread over the cooled brownies."
  ],
  "tips": [],
  "ovenTemp": "350°F",
  "cookTime": "25 minutes",
  "yield": "Makes 30",
  "editorNotes": [
   "Topping ingredients are cut off in the scan: '⅓ cup evaporated' completed as evaporated milk and '½ cup chocolate c' as chocolate chips, based on the method.",
   "Topping boil time '3 minut' read as 3 minutes."
  ]
 },
 {
  "id": "chocolate-mint-sticks",
  "title": "Chocolate Mint Sticks",
  "category": "Cookies & Bars",
  "book": "mountain",
  "contributor": "Mrs. J. Douglas Machesney",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": "Bars",
    "items": [
     {
      "qty": "2 (1 oz.) squares",
      "item": "unsweetened chocolate"
     },
     {
      "qty": "½ cup",
      "item": "butter"
     },
     {
      "qty": "2",
      "item": "eggs"
     },
     {
      "qty": "1 tsp.",
      "item": "vanilla"
     },
     {
      "qty": "½ cup",
      "item": "flour"
     },
     {
      "qty": "¼ tsp.",
      "item": "baking powder"
     },
     {
      "qty": "¼ tsp.",
      "item": "salt"
     },
     {
      "qty": "½ cup",
      "item": "chopped nuts"
     },
     {
      "qty": "1 cup",
      "item": "sugar"
     }
    ]
   },
   {
    "name": "Icing",
    "items": [
     {
      "qty": "3 Tbsp.",
      "item": "butter, divided"
     },
     {
      "qty": "1 cup",
      "item": "powdered sugar"
     },
     {
      "qty": "1 Tbsp.",
      "item": "cream"
     },
     {
      "qty": "¾ tsp.",
      "item": "peppermint extract"
     },
     {
      "qty": "1 (1 oz.) square",
      "item": "unsweetened chocolate"
     }
    ]
   }
  ],
  "steps": [
   "Melt chocolate and butter together. Cool.",
   "Add eggs, sugar, vanilla, flour, baking powder and salt. Mix well.",
   "Add nuts.",
   "Pour into a greased 9\" × 13\" pan and bake at 350°F for 15 minutes. Cool.",
   "Combine 2 Tbsp. butter, cream, powdered sugar and peppermint extract; frost the bars.",
   "Chill until firm.",
   "Melt the chocolate square with the remaining 1 Tbsp. butter and drizzle over the white frosting.",
   "Cut into 1\" × 3\" sticks."
  ],
  "tips": [],
  "ovenTemp": "350°F",
  "cookTime": "15 minutes",
  "yield": "Makes 36",
  "editorNotes": []
 },
 {
  "id": "cookies-while-you-sleep",
  "title": "Cookies While You Sleep",
  "category": "Cookies & Bars",
  "book": "mountain",
  "contributor": "Mrs. William T. Brotherton, Jr.",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "2",
      "item": "egg whites"
     },
     {
      "qty": "Pinch",
      "item": "salt"
     },
     {
      "qty": "⅔ cup",
      "item": "sugar"
     },
     {
      "qty": "½ tsp.",
      "item": "almond extract"
     },
     {
      "qty": "1 tsp.",
      "item": "vanilla extract"
     },
     {
      "qty": "1 cup",
      "item": "chocolate chips"
     },
     {
      "qty": "1 cup",
      "item": "finely chopped nuts"
     }
    ]
   }
  ],
  "steps": [
   "Beat egg whites until frothy. Add salt and continue beating until stiff.",
   "Gradually add sugar and beat until very thick.",
   "Add almond and vanilla extracts.",
   "Fold in chocolate chips and nuts.",
   "Line a cookie sheet with aluminum foil and drop the mixture by teaspoons onto the sheet.",
   "Put the cookies in a 350°F oven, close the door tightly, and turn off the heat.",
   "Leave them in the oven overnight."
  ],
  "tips": [],
  "ovenTemp": "350°F (preheated, then turned off)",
  "cookTime": "Overnight in the cooling oven",
  "yield": "Makes about 3 dozen",
  "editorNotes": []
 },
 {
  "id": "k-cookies",
  "title": "\"K\" Cookies",
  "category": "Cookies & Bars",
  "book": "mountain",
  "contributor": "Mrs. T. A. Galyean",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "1 stick",
      "item": "butter or margarine"
     },
     {
      "qty": "¾ cup",
      "item": "light brown sugar, firmly packed"
     },
     {
      "qty": "¼ cup",
      "item": "granulated sugar"
     },
     {
      "qty": "1",
      "item": "egg"
     },
     {
      "qty": "1 cup",
      "item": "flour"
     },
     {
      "qty": "½ tsp.",
      "item": "baking soda"
     },
     {
      "qty": "¼ tsp.",
      "item": "salt"
     },
     {
      "qty": "1 tsp.",
      "item": "vanilla"
     },
     {
      "qty": "2 cups",
      "item": "Special K cereal"
     },
     {
      "qty": "¼ cup",
      "item": "chopped nuts"
     },
     {
      "qty": "½ to ¾ cup",
      "item": "shredded coconut"
     }
    ]
   }
  ],
  "steps": [
   "Cream butter and both sugars until fluffy.",
   "Add egg and continue to beat.",
   "Sift flour, soda and salt together and add; beat only until well mixed.",
   "Fold in vanilla, cereal, nuts and coconut.",
   "Drop by spoonfuls onto an ungreased cookie sheet.",
   "Bake at 350°F for about 10 minutes.",
   "Remove from the hot sheet immediately and leave upside down to cool so they do not stick together."
  ],
  "tips": [],
  "ovenTemp": "350°F",
  "cookTime": "About 10 minutes",
  "yield": "Makes 50 cookies",
  "editorNotes": []
 },
 {
  "id": "stir-n-drop-cookies",
  "title": "Stir-N-Drop Cookies",
  "category": "Cookies & Bars",
  "book": "mountain",
  "contributor": "Mrs. John C. Thomas",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "2",
      "item": "eggs"
     },
     {
      "qty": "¾ cup",
      "item": "sugar"
     },
     {
      "qty": "⅔ cup",
      "item": "cooking oil"
     },
     {
      "qty": "2 cups",
      "item": "flour"
     },
     {
      "qty": "2 tsp.",
      "item": "vanilla"
     },
     {
      "qty": "2 tsp.",
      "item": "baking powder"
     },
     {
      "qty": "1 tsp.",
      "item": "grated lemon rind"
     },
     {
      "qty": "½ tsp.",
      "item": "salt"
     },
     {
      "qty": "1 cup",
      "item": "raisins or nuts"
     },
     {
      "qty": "",
      "item": "Sugar, for stamping"
     }
    ]
   }
  ],
  "steps": [
   "Beat eggs. Stir in oil, vanilla and lemon rind.",
   "Blend in sugar until the mixture thickens.",
   "Sift together flour, baking powder and salt; add to the egg mixture. (The batter will be soft.)",
   "Add raisins or nuts.",
   "Drop by teaspoons about 2 inches apart on an ungreased cookie sheet.",
   "Stamp each cookie flat with the bottom of a glass dipped in sugar (lightly oil the glass, then dip in sugar). Keep dipping so the bottom stays covered.",
   "Bake at 400°F for 8 to 10 minutes.",
   "Remove immediately from the sheet and cool on a rack."
  ],
  "tips": [],
  "ovenTemp": "400°F",
  "cookTime": "8–10 minutes",
  "yield": "Makes 3 dozen 3\" cookies",
  "editorNotes": [
   "Oil quantity printed as 'з cup' (garbled); ⅔ cup is a best guess.",
   "Glass instruction garbled ('lightly glass, ti lip in sugar'); read as lightly oil the glass, then dip in sugar."
  ]
 },
 {
  "id": "vanilla-refrigerator-cookies",
  "title": "Vanilla Refrigerator Cookies",
  "category": "Cookies & Bars",
  "book": "mountain",
  "contributor": "Mrs. William C. Payne",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "1 cup",
      "item": "shortening (½ cup of it butter)"
     },
     {
      "qty": "2 cups",
      "item": "sugar"
     },
     {
      "qty": "½ cup",
      "item": "brown sugar"
     },
     {
      "qty": "2",
      "item": "eggs, beaten"
     },
     {
      "qty": "4 cups",
      "item": "sifted flour"
     },
     {
      "qty": "3 tsp.",
      "item": "baking powder"
     },
     {
      "qty": "¼ tsp.",
      "item": "salt"
     },
     {
      "qty": "1 cup",
      "item": "nuts"
     },
     {
      "qty": "1 Tbsp.",
      "item": "vanilla"
     }
    ]
   }
  ],
  "steps": [
   "Cream shortening and sugars.",
   "Add eggs and beat until light.",
   "Sift together flour, baking powder and salt; add to the creamed mixture and mix well.",
   "Add nuts and vanilla.",
   "Shape into rolls about 2\" in diameter and refrigerate overnight.",
   "Slice ¼\" thick and bake on a greased cookie sheet at 425°F for about 8 minutes."
  ],
  "tips": [],
  "ovenTemp": "425°F",
  "cookTime": "About 8 minutes",
  "yield": null,
  "editorNotes": []
 },
 {
  "id": "linzer-tarts",
  "title": "Linzer Tarts",
  "category": "Cookies & Bars",
  "book": "mountain",
  "contributor": "Mrs. Chapman Revercomb",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "1 lb.",
      "item": "butter"
     },
     {
      "qty": "1 cup",
      "item": "sugar"
     },
     {
      "qty": "2",
      "item": "eggs, well beaten"
     },
     {
      "qty": "1 Tbsp.",
      "item": "brandy"
     },
     {
      "qty": "2 tsp.",
      "item": "salt"
     },
     {
      "qty": "1½ tsp.",
      "item": "cinnamon"
     },
     {
      "qty": "3 cups",
      "item": "flour"
     },
     {
      "qty": "¼ tsp.",
      "item": "baking powder"
     },
     {
      "qty": "½ lb.",
      "item": "pecans, coarsely ground or chopped"
     },
     {
      "qty": "1 large jar",
      "item": "red raspberry jam"
     }
    ]
   }
  ],
  "steps": [
   "Cream butter and sugar. Add eggs and brandy.",
   "Sift the dry ingredients together and add with the pecans. Mix well and chill thoroughly.",
   "Save a portion of dough for a lattice top.",
   "Pat the rest into two 9\" pie pans, bringing it ½ inch up the sides.",
   "Spoon jam smoothly over the dough and lay strips of dough over the top.",
   "Bake at 300°F for 1 hour.",
   "Cut into small triangular pieces."
  ],
  "tips": [
   "Rolling the dough between sheets of waxed paper makes it easier to handle."
  ],
  "ovenTemp": "300°F",
  "cookTime": "1 hour",
  "yield": "Makes two 9\" pies",
  "editorNotes": [
   "2 tsp. salt is high for this amount; printed as shown."
  ]
 },
 {
  "id": "apple-pecan-cobbler",
  "title": "Apple Pecan Cobbler",
  "category": "Desserts",
  "book": "mountain",
  "contributor": "Mrs. Frederick H. Morgan",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": "Cinnamon layer",
    "items": [
     {
      "qty": "½ cup",
      "item": "sugar"
     },
     {
      "qty": "½ tsp.",
      "item": "cinnamon"
     },
     {
      "qty": "½ cup",
      "item": "coarsely chopped pecans (from the ¾ cup)"
     }
    ]
   },
   {
    "name": "Fruit",
    "items": [
     {
      "qty": "4 cups",
      "item": "tart apples, pared and thinly sliced"
     }
    ]
   },
   {
    "name": "Batter",
    "items": [
     {
      "qty": "1 cup",
      "item": "sifted flour"
     },
     {
      "qty": "1 cup",
      "item": "sugar"
     },
     {
      "qty": "1 tsp.",
      "item": "baking powder"
     },
     {
      "qty": "¼ tsp.",
      "item": "salt"
     },
     {
      "qty": "1",
      "item": "egg, well beaten"
     },
     {
      "qty": "½ cup",
      "item": "evaporated milk"
     },
     {
      "qty": "⅓ cup",
      "item": "butter or margarine, melted"
     },
     {
      "qty": "¼ cup",
      "item": "coarsely chopped pecans (remainder)"
     }
    ]
   },
   {
    "name": "For serving",
    "items": [
     {
      "qty": "",
      "item": "Whipped cream or ice cream"
     }
    ]
   }
  ],
  "steps": [
   "Mix ½ cup sugar, cinnamon and ½ cup of the pecans.",
   "Place the apples in a greased 8½\" × 1¾\" round baking dish and sprinkle with the cinnamon mixture.",
   "Sift together flour, 1 cup sugar, baking powder and salt.",
   "Combine egg, milk and butter; add the dry ingredients all at once and mix until smooth.",
   "Pour over the apples and sprinkle with the remaining pecans.",
   "Bake at 325°F about 55 minutes, or until done."
  ],
  "tips": [
   "Spoon warm cobbler onto dessert plates and top with cinnamon-flavored whipped cream or ice cream."
  ],
  "ovenTemp": "325°F",
  "cookTime": "About 55 minutes",
  "yield": "Serves 8",
  "editorNotes": [
   "Source lists ½ cup and 1 cup sugar without saying which goes where; ½ cup assigned to the cinnamon mixture and 1 cup to the batter (best guess).",
   "Dish size printed as '84\" x 1¾\"'; read as 8½\" × 1¾\"."
  ]
 },
 {
  "id": "hippo-s-heaven",
  "title": "Hippo's \"Heaven\"",
  "category": "Desserts",
  "book": "mountain",
  "contributor": "Mrs. Charles W. Yeager",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "1 box",
      "item": "vanilla wafers"
     },
     {
      "qty": "½ lb.",
      "item": "butter"
     },
     {
      "qty": "1 lb.",
      "item": "powdered sugar"
     },
     {
      "qty": "4",
      "item": "eggs"
     },
     {
      "qty": "1 pint",
      "item": "whipping cream"
     },
     {
      "qty": "1 (16 oz.) can",
      "item": "crushed pineapple, drained"
     },
     {
      "qty": "1 cup",
      "item": "chopped pecans"
     }
    ]
   }
  ],
  "steps": [
   "Crush the vanilla wafers and place half in a square pan.",
   "Cream butter and sugar, then beat in the eggs.",
   "Whip the cream; fold in the drained pineapple and nuts.",
   "Place the remaining crushed wafers on top.",
   "Refrigerate overnight."
  ],
  "tips": [],
  "ovenTemp": null,
  "cookTime": "Overnight (chill)",
  "yield": "Serves 10",
  "editorNotes": [
   "The method never says to spread the butter mixture or the cream mixture into the pan; presumably layer butter mixture, then cream mixture, over the wafers before topping.",
   "Uses raw eggs."
  ]
 },
 {
  "id": "maple-mousse",
  "title": "Maple Mousse",
  "category": "Desserts",
  "book": "mountain",
  "contributor": "Mrs. Helen Townsend Ziebold",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "¾ cup",
      "item": "maple syrup"
     },
     {
      "qty": "2",
      "item": "egg whites, beaten stiff"
     },
     {
      "qty": "1 cup",
      "item": "cream, whipped"
     },
     {
      "qty": "¼ cup",
      "item": "chopped pecans"
     },
     {
      "qty": "1 tsp.",
      "item": "vanilla"
     },
     {
      "qty": "",
      "item": "Lady fingers"
     }
    ]
   }
  ],
  "steps": [
   "Boil the syrup for 1 minute and pour slowly into the beaten egg whites.",
   "Beat for 3 minutes after all the syrup is added. Set aside to cool.",
   "Fold in the whipped cream. Add nuts and vanilla.",
   "Place in an ice tray or shallow pan and freeze 4 to 5 hours."
  ],
  "tips": [
   "Serve in parfait glasses with lady fingers."
  ],
  "ovenTemp": null,
  "cookTime": "4–5 hours (freeze)",
  "yield": "Serves 4",
  "editorNotes": []
 },
 {
  "id": "baked-devil-s-float",
  "title": "Baked Devil's Float",
  "category": "Desserts",
  "book": "mountain",
  "contributor": "Mrs. William T. Ziebold",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": "Dough",
    "items": [
     {
      "qty": "1 cup",
      "item": "flour"
     },
     {
      "qty": "½ tsp.",
      "item": "salt"
     },
     {
      "qty": "2 tsp.",
      "item": "baking powder"
     },
     {
      "qty": "¾ cup",
      "item": "granulated sugar"
     },
     {
      "qty": "1 (1 oz.) square",
      "item": "unsweetened chocolate, melted"
     },
     {
      "qty": "½ cup",
      "item": "milk"
     },
     {
      "qty": "1 tsp.",
      "item": "vanilla"
     },
     {
      "qty": "½ cup",
      "item": "chopped pecans"
     }
    ]
   },
   {
    "name": "Topping",
    "items": [
     {
      "qty": "½ cup",
      "item": "granulated sugar"
     },
     {
      "qty": "½ cup",
      "item": "brown sugar"
     },
     {
      "qty": "2 Tbsp.",
      "item": "cocoa"
     },
     {
      "qty": "1 cup",
      "item": "boiling water"
     }
    ]
   },
   {
    "name": "For serving",
    "items": [
     {
      "qty": "",
      "item": "Vanilla ice cream or whipped cream"
     }
    ]
   }
  ],
  "steps": [
   "Sift together flour, salt, baking powder and sugar.",
   "Add milk and chocolate and mix well. Add vanilla and nuts.",
   "Put into a greased 9\" baking pan.",
   "Sift the topping sugars and cocoa together and sprinkle over the dough.",
   "Pour 1 cup boiling water over the top.",
   "Bake at 350°F until a crust forms on top."
  ],
  "tips": [
   "Serve with vanilla ice cream or whipped cream on top."
  ],
  "ovenTemp": "350°F",
  "cookTime": null,
  "yield": "Serves 6 to 8",
  "editorNotes": [
   "Bake time printed as 't0 minute' — likely 40 minutes, but unreadable.",
   "Contributor printed 'Ziebol'; corrected to Ziebold to match the previous recipe."
  ]
 },
 {
  "id": "dromedary-pudding",
  "title": "Dromedary Pudding",
  "category": "Desserts",
  "book": "mountain",
  "contributor": "Mrs. F. G. Bannerot, Jr.",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": "Pudding",
    "items": [
     {
      "qty": "2",
      "item": "eggs"
     },
     {
      "qty": "1 cup",
      "item": "sugar"
     },
     {
      "qty": "Pinch",
      "item": "salt"
     },
     {
      "qty": "1 Tbsp.",
      "item": "flour"
     },
     {
      "qty": "1 tsp.",
      "item": "baking powder"
     },
     {
      "qty": "1 cup",
      "item": "chopped nuts"
     },
     {
      "qty": "1 cup",
      "item": "dates, pitted and cut"
     }
    ]
   },
   {
    "name": "Vanilla Sauce",
    "items": [
     {
      "qty": "1 cup",
      "item": "sugar"
     },
     {
      "qty": "2 Tbsp.",
      "item": "cornstarch"
     },
     {
      "qty": "2 cups",
      "item": "water"
     },
     {
      "qty": "4 Tbsp.",
      "item": "margarine or butter"
     },
     {
      "qty": "2 tsp.",
      "item": "vanilla"
     },
     {
      "qty": "Dash",
      "item": "nutmeg (optional)"
     }
    ]
   }
  ],
  "steps": [
   "Stir together eggs, sugar, salt, flour and baking powder; add nuts and dates.",
   "Thoroughly grease and flour an 8\" square pan.",
   "Bake at 300°F for 45 minutes.",
   "For the sauce, mix sugar and cornstarch in a saucepan; gradually stir in the water.",
   "Bring to a boil and boil 1 minute, stirring constantly.",
   "Stir in margarine, vanilla and nutmeg."
  ],
  "tips": [
   "Serve with whipped cream or vanilla sauce."
  ],
  "ovenTemp": "300°F",
  "cookTime": "45 minutes",
  "yield": "Serves 6 to 8; sauce makes 2 cups",
  "editorNotes": [
   "No location printed.",
   "Sauce method garbled ('Gra Bring to a boil'); the water step is inferred as 'gradually stir in water'.",
   "Dromedary was a brand of packaged dates."
  ]
 },
 {
  "id": "opal-s-apple-pudding",
  "title": "Opal's Apple Pudding",
  "category": "Desserts",
  "book": "mountain",
  "contributor": "Mrs. John Raynes",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "¼ cup",
      "item": "shortening"
     },
     {
      "qty": "⅔ cup",
      "item": "white sugar"
     },
     {
      "qty": "½ cup",
      "item": "brown sugar"
     },
     {
      "qty": "2 cups",
      "item": "raw apples, peeled and chopped"
     },
     {
      "qty": "¼ cup",
      "item": "chopped nuts"
     },
     {
      "qty": "1",
      "item": "egg"
     },
     {
      "qty": "1 cup",
      "item": "flour"
     },
     {
      "qty": "1 tsp.",
      "item": "baking soda"
     },
     {
      "qty": "½ tsp.",
      "item": "nutmeg"
     },
     {
      "qty": "½ tsp.",
      "item": "cinnamon"
     },
     {
      "qty": "",
      "item": "Whipped topping, for garnish"
     }
    ]
   }
  ],
  "steps": [
   "Cream together the shortening and both sugars.",
   "Add apples, nuts and egg. Mix well.",
   "Mix the flour, baking soda, nutmeg and cinnamon; add to the apple mixture.",
   "Bake in a greased pan at 350°F for 30 minutes."
  ],
  "tips": [
   "Serve warm with whipped topping."
  ],
  "ovenTemp": "350°F",
  "cookTime": "30 minutes",
  "yield": "Serves 6 to 8",
  "editorNotes": [
   "No location printed.",
   "Pan size not given."
  ]
 },
 {
  "id": "black-walnut-candy",
  "title": "Black Walnut Candy",
  "category": "Candies",
  "book": "mountain",
  "contributor": "Mrs. Carl B. Hall, Jr.",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "1 cup",
      "item": "sugar"
     },
     {
      "qty": "1 cup",
      "item": "water"
     },
     {
      "qty": "1 tsp.",
      "item": "salt"
     },
     {
      "qty": "1 cup",
      "item": "shelled black walnuts"
     },
     {
      "qty": "½ tsp.",
      "item": "rum extract (optional)"
     }
    ]
   }
  ],
  "steps": [
   "Cook sugar and water until it barely threads (235°F); let stand until the bubbles leave.",
   "Add salt and beat until cloudy.",
   "Add walnuts and rum extract and beat until fairly stiff.",
   "Pour onto a board, let set, and break into pieces."
  ],
  "tips": [],
  "ovenTemp": null,
  "cookTime": null,
  "yield": null,
  "editorNotes": [
   "No location printed."
  ]
 },
 {
  "id": "buttermilk-pralines",
  "title": "Buttermilk Pralines",
  "category": "Candies",
  "book": "mountain",
  "contributor": "Mrs. Samuel W. Channell",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "2 cups",
      "item": "white sugar"
     },
     {
      "qty": "1 cup",
      "item": "buttermilk"
     },
     {
      "qty": "1 tsp.",
      "item": "baking soda"
     },
     {
      "qty": "⅛ tsp.",
      "item": "salt"
     },
     {
      "qty": "12 Tbsp.",
      "item": "butter or margarine"
     },
     {
      "qty": "1 tsp.",
      "item": "vanilla"
     },
     {
      "qty": "2 cups",
      "item": "broken pecans"
     }
    ]
   }
  ],
  "steps": [
   "Mix sugar, buttermilk, soda and salt in a heavy 3-quart saucepan.",
   "Cook over medium heat to the soft-ball stage. Cool.",
   "Beat in butter and vanilla and stir in pecans.",
   "Drop by tablespoons onto wax paper to cool. Work fast."
  ],
  "tips": [
   "If it starts to harden in the pan, add a few drops of buttermilk, reheat and stir well."
  ],
  "ovenTemp": null,
  "cookTime": null,
  "yield": null,
  "editorNotes": [
   "12 Tbsp. butter (1½ sticks) printed as shown; may have been '1½ Tbsp.' garbled, but left as printed."
  ]
 },
 {
  "id": "chocolate-nuggets",
  "title": "Chocolate Nuggets",
  "category": "Candies",
  "book": "mountain",
  "contributor": "Mrs. Charles G. Moyers, Jr.",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "1 cup (6 oz. pkg.)",
      "item": "semi-sweet chocolate pieces"
     },
     {
      "qty": "2½ cups (7¼ oz. pkg.)",
      "item": "finely crushed vanilla wafers"
     },
     {
      "qty": "½ cup",
      "item": "cola beverage"
     },
     {
      "qty": "3 Tbsp.",
      "item": "light corn syrup"
     },
     {
      "qty": "2 cups",
      "item": "powdered sugar, sifted"
     },
     {
      "qty": "1 Tbsp.",
      "item": "rum extract"
     },
     {
      "qty": "1 cup",
      "item": "finely chopped nuts"
     },
     {
      "qty": "",
      "item": "Chocolate decorating candies"
     }
    ]
   }
  ],
  "steps": [
   "Melt chocolate in a double boiler over hot water; remove from heat.",
   "Blend in cola, corn syrup and rum extract.",
   "Stir in crumbs, sugar and nuts, mixing thoroughly (it will be sticky and stiff).",
   "Cover and chill about 2 hours, until easy to handle.",
   "Roll into small balls, about 1 rounded teaspoon each.",
   "Roll in decorating candies to coat.",
   "Place in a single layer on wax paper in a shallow pan, cover loosely, and chill overnight."
  ],
  "tips": [
   "Chilling overnight firms them up and mellows the flavors."
  ],
  "ovenTemp": null,
  "cookTime": null,
  "yield": "Makes about 3 dozen",
  "editorNotes": [
   "No location printed.",
   "'sweet chocolate pieces / semi-' split across lines; read as semi-sweet."
  ]
 },
 {
  "id": "fudge-candy",
  "title": "Fudge Candy",
  "category": "Candies",
  "book": "mountain",
  "contributor": "Mrs. Carroll Dorsey",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "4 cups",
      "item": "sugar"
     },
     {
      "qty": "1 (13 oz.) can",
      "item": "evaporated milk"
     },
     {
      "qty": "½ lb.",
      "item": "butter"
     },
     {
      "qty": "2½ cups",
      "item": "chocolate chips"
     },
     {
      "qty": "1 jar",
      "item": "marshmallow cream"
     },
     {
      "qty": "2 cups",
      "item": "nuts"
     }
    ]
   }
  ],
  "steps": [
   "Boil sugar and milk for 5 minutes.",
   "Add butter and boil 7 minutes more.",
   "Add chocolate chips, marshmallow cream and nuts.",
   "Pour into a shallow pan and chill until set."
  ],
  "tips": [],
  "ovenTemp": null,
  "cookTime": null,
  "yield": null,
  "editorNotes": [
   "No location printed.",
   "Jar size of marshmallow cream not given (commonly 7 oz.)."
  ]
 },
 {
  "id": "peanut-log",
  "title": "Peanut Log",
  "category": "Candies",
  "book": "mountain",
  "contributor": "Miss Betty Cook",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "1 box",
      "item": "powdered sugar"
     },
     {
      "qty": "½ cup",
      "item": "peanut butter"
     },
     {
      "qty": "1 cup",
      "item": "shredded coconut"
     },
     {
      "qty": "1 cup",
      "item": "chopped nuts"
     },
     {
      "qty": "1 cup",
      "item": "graham cracker crumbs"
     },
     {
      "qty": "1 tsp.",
      "item": "vanilla"
     },
     {
      "qty": "1 cup",
      "item": "margarine or butter, melted"
     }
    ]
   },
   {
    "name": "Coating",
    "items": [
     {
      "qty": "1 (6 oz.) pkg.",
      "item": "chocolate chips"
     },
     {
      "qty": "½ block",
      "item": "paraffin"
     }
    ]
   }
  ],
  "steps": [
   "Mix the first six ingredients.",
   "Pour melted butter over the mixture and roll into logs or balls.",
   "Melt chocolate chips and paraffin over boiling water.",
   "Dip the logs in chocolate and lift out with a fork."
  ],
  "tips": [
   "Keeps a long time stored in a tin in the refrigerator."
  ],
  "ovenTemp": null,
  "cookTime": null,
  "yield": null,
  "editorNotes": [
   "No location printed.",
   "Ingredient columns were jumbled in the scan ('peanut butter melted', '1 teaspoon vanilla chips'); 'melted' belongs to the butter and 'chips' to the chocolate.",
   "Paraffin wax was a common candy coating then; it is no longer recommended as food — use chocolate alone or a little shortening instead."
  ]
 },
 {
  "id": "grape-salad",
  "title": "Grape Salad",
  "category": "Salads",
  "book": "woodlands",
  "contributor": "Gerry Bryant",
  "contributorRole": "Director of Nursing",
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "2 lbs.",
      "item": "green seedless grapes"
     },
     {
      "qty": "2 lbs.",
      "item": "red seedless grapes"
     },
     {
      "qty": "8 oz.",
      "item": "cream cheese"
     },
     {
      "qty": "8 oz.",
      "item": "sour cream"
     },
     {
      "qty": "1 cup",
      "item": "sugar"
     },
     {
      "qty": "1 tsp.",
      "item": "vanilla"
     },
     {
      "qty": "1 cup",
      "item": "broken pecans"
     },
     {
      "qty": "½ cup",
      "item": "brown sugar"
     }
    ]
   }
  ],
  "steps": [
   "Blend the cream cheese and sugar well.",
   "Add the sour cream and vanilla and blend well.",
   "Pour over the grapes and stir to coat.",
   "Top with the pecans and brown sugar."
  ],
  "tips": [
   "Best served refrigerated."
  ],
  "ovenTemp": null,
  "cookTime": null,
  "yield": null,
  "editorNotes": [
   "This recipe appears after a section header reading 'Savoring the Taste of Generations — Woodlands Retirement Community', so it likely comes from a different cookbook than the 1963 Logan collection."
  ]
 },
 {
  "id": "great-salad",
  "title": "Great Salad",
  "category": "Salads",
  "book": "woodlands",
  "contributor": "Trish Sansom",
  "contributorRole": "Nursing staff",
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": "Salad",
    "items": [
     {
      "qty": "1 bunch",
      "item": "broccoli, chopped"
     },
     {
      "qty": "1 head",
      "item": "romaine lettuce"
     },
     {
      "qty": "4",
      "item": "green onions"
     },
     {
      "qty": "1 cup",
      "item": "pecans, chopped"
     },
     {
      "qty": "1 pkg.",
      "item": "ramen noodles (discard flavor packet)"
     },
     {
      "qty": "1 Tbsp.",
      "item": "sugar"
     },
     {
      "qty": "4 Tbsp.",
      "item": "butter"
     }
    ]
   },
   {
    "name": "Dressing",
    "items": [
     {
      "qty": "1 cup",
      "item": "oil"
     },
     {
      "qty": "1 cup",
      "item": "sugar"
     },
     {
      "qty": "3 Tbsp.",
      "item": "soy sauce"
     },
     {
      "qty": "½ cup",
      "item": "wine vinegar"
     },
     {
      "qty": "",
      "item": "Salt and pepper to taste"
     }
    ]
   }
  ],
  "steps": [
   "Mix the broccoli, romaine and green onions and let stand overnight.",
   "The next day, brown the pecans and noodles in the butter and sugar (do not use the noodle flavor packet).",
   "Blend the dressing ingredients in a blender for 5 minutes.",
   "Toss everything together just before eating."
  ],
  "tips": [],
  "ovenTemp": null,
  "cookTime": null,
  "yield": null,
  "editorNotes": [
   "This recipe appears after a section header reading 'Savoring the Taste of Generations — Woodlands Retirement Community', so it likely comes from a different cookbook than the 1963 Logan collection.",
   "Says to 'set overnight' — presumably refrigerated."
  ]
 },
 {
  "id": "sweet-potato-casserole",
  "title": "Sweet Potato Casserole",
  "category": "Vegetables & Sides",
  "book": "woodlands",
  "contributor": "Freda Ashworth",
  "contributorRole": "Resident",
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "3 cups",
      "item": "cooked, mashed sweet potatoes"
     },
     {
      "qty": "1 cup",
      "item": "sugar"
     },
     {
      "qty": "2",
      "item": "eggs"
     },
     {
      "qty": "1 tsp.",
      "item": "vanilla extract"
     },
     {
      "qty": "⅓ cup",
      "item": "milk"
     },
     {
      "qty": "½ cup",
      "item": "butter or margarine"
     }
    ]
   },
   {
    "name": "Topping",
    "items": [
     {
      "qty": "1 cup",
      "item": "firmly packed brown sugar"
     },
     {
      "qty": "⅓ cup",
      "item": "all-purpose flour"
     },
     {
      "qty": "1 cup",
      "item": "finely chopped pecans"
     },
     {
      "qty": "⅓ cup",
      "item": "butter or margarine"
     }
    ]
   }
  ],
  "steps": [
   "Combine sweet potatoes, sugar, eggs, vanilla, milk and ½ cup butter; beat with an electric mixer until smooth.",
   "Spoon into a greased 2-quart shallow casserole dish.",
   "Combine brown sugar, flour and pecans and sprinkle over the top of the casserole.",
   "Bake at 350°F for 30 minutes."
  ],
  "tips": [],
  "ovenTemp": "350°F",
  "cookTime": "30 minutes",
  "yield": "8 to 10 servings",
  "editorNotes": [
   "Vanilla printed as \"isp.\"; 1 tsp. is a best guess.",
   "Butter quantities garbled (\"1h c\", \"c.\", \"⅓ cup\"). Method calls for ½ cup butter in the potatoes; the topping butter amount is a best guess of ⅓ cup and the method never says how to use it (presumably mixed into the topping).",
   "Contributor role printed as \"resident\" with no location; this section appears to come from a separate residents' collection, not the 1963 Logan book."
  ]
 },
 {
  "id": "sweet-potato-souffle",
  "title": "Sweet Potato Soufflé",
  "category": "Vegetables & Sides",
  "book": "woodlands",
  "contributor": "Leonard Eblin",
  "contributorRole": "Resident",
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "1 large can",
      "item": "sweet potatoes"
     },
     {
      "qty": "1 stick",
      "item": "butter, melted"
     },
     {
      "qty": "1 cup",
      "item": "sugar"
     },
     {
      "qty": "2",
      "item": "whole eggs"
     },
     {
      "qty": "½ tsp.",
      "item": "salt"
     },
     {
      "qty": "½ cup",
      "item": "milk"
     }
    ]
   },
   {
    "name": "Topping",
    "items": [
     {
      "qty": "1 cup",
      "item": "brown sugar"
     },
     {
      "qty": "½ cup",
      "item": "flour"
     },
     {
      "qty": "1 cup",
      "item": "pecans"
     },
     {
      "qty": "⅓ cup",
      "item": "melted butter"
     }
    ]
   }
  ],
  "steps": [
   "Drain and mash the sweet potatoes.",
   "Add the melted butter and the next four ingredients.",
   "Place in a buttered baking dish.",
   "Mix together the last four ingredients and crumble over the potatoes as a topping.",
   "Bake uncovered at 350°F for 35 minutes."
  ],
  "tips": [
   "Leonard's daughter Judy sent in this recipe. The family first had it at the LaComedia Theater in Dayton, Ohio, and asked for the recipe; it became known as \"Paw Paw's sweet potatoes,\" which he always made for family gatherings."
  ],
  "ovenTemp": "350°F",
  "cookTime": "35 minutes (prep 15 minutes)",
  "yield": "8 servings",
  "editorNotes": [
   "Stick of butter printed without a count; 1 stick is a best guess.",
   "\"Next four ingredients\" / \"last four ingredients\" refer to the printed list order, which the OCR scrambled; the split shown (sugar, eggs, salt, milk in the potatoes; brown sugar, flour, pecans, melted butter as topping) is a best guess."
  ]
 },
 {
  "id": "wild-rice-stuffing",
  "title": "Wild Rice Stuffing",
  "category": "Vegetables & Sides",
  "book": "woodlands",
  "contributor": "Jean Coffey",
  "contributorRole": "Resident",
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "1½ cups",
      "item": "wild rice"
     },
     {
      "qty": "2 Tbsp.",
      "item": "butter, softened"
     },
     {
      "qty": "½ cup",
      "item": "finely chopped onion"
     },
     {
      "qty": "",
      "item": "turkey livers, chopped"
     },
     {
      "qty": "3 Tbsp.",
      "item": "butter"
     },
     {
      "qty": "½ lb.",
      "item": "mushrooms, chopped"
     },
     {
      "qty": "¼ cup",
      "item": "chopped celery"
     },
     {
      "qty": "½ cup",
      "item": "chopped pecans"
     },
     {
      "qty": "¼ cup",
      "item": "chopped fresh parsley"
     },
     {
      "qty": "½ tsp.",
      "item": "thyme"
     },
     {
      "qty": "½ tsp.",
      "item": "marjoram"
     },
     {
      "qty": "",
      "item": "salt and pepper to taste"
     }
    ]
   }
  ],
  "steps": [
   "Rinse the wild rice three or four times in cold water. Soak for ½ hour, then drain.",
   "Put in a large kettle of boiling salted water and boil slowly, uncovered, for ½ hour.",
   "Drain the rice in a sieve and set the sieve over a pan of lightly boiling water. Cover with a lid and steam for 1 hour.",
   "When the rice is puffed open, place in a shallow dish, add 2 Tbsp. softened butter and fluff with a fork.",
   "In a skillet, sauté the onion and chopped turkey livers in 3 Tbsp. butter over low heat for 2 minutes.",
   "Add mushrooms and celery and sauté over moderate heat 3 or 4 minutes.",
   "Combine the mushroom mixture with the rice. Add pecans, parsley, thyme and marjoram. Salt and pepper to taste.",
   "Let the mixture cool before stuffing the turkey."
  ],
  "tips": [
   "This is for the Thanksgiving turkey. Do not stuff the bird until just before it goes in the oven."
  ],
  "ovenTemp": null,
  "cookTime": null,
  "yield": null,
  "editorNotes": [
   "Liver quantity not given; the method says \"the livers of the turkey.\""
  ]
 },
 {
  "id": "cranberry-orange-nut-bread",
  "title": "Cranberry-Orange Nut Bread",
  "category": "Breads",
  "book": "woodlands",
  "contributor": "Jeanne Macri",
  "contributorRole": "Nursing staff",
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "1 cup",
      "item": "whole-wheat flour"
     },
     {
      "qty": "1 cup",
      "item": "all-purpose flour"
     },
     {
      "qty": "1½ tsp.",
      "item": "baking powder"
     },
     {
      "qty": "½ tsp.",
      "item": "baking soda"
     },
     {
      "qty": "1 cup",
      "item": "sugar"
     },
     {
      "qty": "",
      "item": "juice of 1 orange"
     },
     {
      "qty": "",
      "item": "boiling water"
     },
     {
      "qty": "2 Tbsp.",
      "item": "butter"
     },
     {
      "qty": "1",
      "item": "egg, well beaten"
     },
     {
      "qty": "1 cup",
      "item": "chopped cranberries"
     },
     {
      "qty": "1 cup",
      "item": "chopped walnuts"
     }
    ]
   }
  ],
  "steps": [
   "Combine flours, baking powder, soda and sugar; set aside.",
   "Add enough boiling water to the orange juice to make ¾ cup liquid. Add butter and stir until melted.",
   "Stir into the dry ingredients. Add egg and mix until smooth.",
   "Fold in cranberries and walnuts.",
   "Spoon batter into a greased and floured 9 x 5 x 3-inch loaf pan.",
   "Bake at 350°F for 50–55 minutes."
  ],
  "tips": [],
  "ovenTemp": "350°F",
  "cookTime": "50–55 minutes",
  "yield": "1 loaf",
  "editorNotes": [
   "Walnuts printed as \"2-1 c.\"; 1 cup is a best guess."
  ]
 },
 {
  "id": "pumpkin-bread-2",
  "title": "Pumpkin Bread",
  "category": "Breads",
  "book": "woodlands",
  "contributor": "Grace and Ed Greene",
  "contributorRole": "Residents",
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "3 cups",
      "item": "sugar"
     },
     {
      "qty": "1 cup",
      "item": "cooking oil"
     },
     {
      "qty": "4",
      "item": "eggs"
     },
     {
      "qty": "1½ tsp.",
      "item": "salt"
     },
     {
      "qty": "1 tsp.",
      "item": "cinnamon and nutmeg"
     },
     {
      "qty": "2 tsp.",
      "item": "baking soda"
     },
     {
      "qty": "1 cup",
      "item": "nuts (walnuts)"
     },
     {
      "qty": "3½ cups",
      "item": "flour"
     },
     {
      "qty": "2 cups",
      "item": "canned pumpkin"
     },
     {
      "qty": "⅔ cup",
      "item": "water"
     },
     {
      "qty": "",
      "item": "small amount of sorghum"
     }
    ]
   }
  ],
  "steps": [
   "Cream sugar, oil and eggs.",
   "Add salt, nutmeg, cinnamon, baking soda, walnuts, flour, pumpkin and water; mix well.",
   "Pour into greased loaf pans.",
   "Bake at 350°F for 1 hour."
  ],
  "tips": [
   "The recipe may be cut in half.",
   "The bread freezes nicely."
  ],
  "ovenTemp": "350°F",
  "cookTime": "1 hour",
  "yield": null,
  "editorNotes": [
   "\"1 tsp. cinnamon and nutmeg\" — unclear whether 1 tsp. each or combined.",
   "Sorghum is listed but never used in the method."
  ]
 },
 {
  "id": "apple-pound-cake",
  "title": "Apple Pound Cake",
  "category": "Cakes",
  "book": "woodlands",
  "contributor": "Esther Bragg",
  "contributorRole": "Resident",
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "2 cups",
      "item": "sugar"
     },
     {
      "qty": "1½ cups",
      "item": "vegetable oil (Wesson or Crisco)"
     },
     {
      "qty": "3",
      "item": "eggs"
     },
     {
      "qty": "3 cups",
      "item": "flour"
     },
     {
      "qty": "1 tsp.",
      "item": "baking soda"
     },
     {
      "qty": "1 tsp.",
      "item": "salt"
     },
     {
      "qty": "1 tsp.",
      "item": "cinnamon"
     },
     {
      "qty": "1 Tbsp.",
      "item": "vanilla"
     },
     {
      "qty": "3 cups",
      "item": "diced, pared apples (about 3½ apples)"
     },
     {
      "qty": "1 cup",
      "item": "chopped walnuts"
     },
     {
      "qty": "1 cup",
      "item": "coconut"
     }
    ]
   }
  ],
  "steps": [
   "Beat sugar, oil and eggs well.",
   "Sift flour, soda, salt and cinnamon; stir or beat into the oil mixture.",
   "Add vanilla, then stir in apples, nuts and coconut.",
   "Bake in a greased tube or Bundt pan at 325°F for 1½ hours."
  ],
  "tips": [],
  "ovenTemp": "325°F",
  "cookTime": "1½ hours",
  "yield": null,
  "editorNotes": []
 },
 {
  "id": "bacardi-rum-cake",
  "title": "Bacardi Rum Cake",
  "category": "Cakes",
  "book": "woodlands",
  "contributor": "Esther Bragg",
  "contributorRole": "Resident",
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": "Cake",
    "items": [
     {
      "qty": "1 cup",
      "item": "chopped pecans or walnuts"
     },
     {
      "qty": "1 (18.5 oz.) pkg.",
      "item": "yellow cake mix"
     },
     {
      "qty": "1 (3.75 oz.) pkg.",
      "item": "vanilla instant pudding"
     },
     {
      "qty": "4",
      "item": "eggs"
     },
     {
      "qty": "½ cup",
      "item": "cold water"
     },
     {
      "qty": "½ cup",
      "item": "Wesson oil"
     },
     {
      "qty": "½ cup",
      "item": "Bacardi dark rum (80 proof)"
     }
    ]
   },
   {
    "name": "Glaze",
    "items": [
     {
      "qty": "¼ lb.",
      "item": "butter (1 stick)"
     },
     {
      "qty": "1 cup",
      "item": "granulated sugar"
     },
     {
      "qty": "¼ cup",
      "item": "water"
     },
     {
      "qty": "½ cup",
      "item": "Bacardi dark rum (80 proof)"
     }
    ]
   }
  ],
  "steps": [
   "Preheat oven to 325°F. Grease and flour a 10-inch tube pan or 12-cup Bundt pan.",
   "Sprinkle nuts over the bottom of the pan.",
   "Mix all cake ingredients together and pour the batter over the nuts.",
   "Bake 1 hour. Cool, invert onto a serving plate and prick the top.",
   "For the glaze, melt butter in a saucepan. Stir in water and sugar and boil, stirring constantly.",
   "Remove from heat and stir in rum.",
   "Drizzle and smooth glaze evenly over the top and sides of the cake. Let the cake absorb the glaze, and repeat until all the glaze is used."
  ],
  "tips": [
   "Optional: decorate with maraschino cherries and a border of sugar frosting or whipped cream. Serve with seedless grapes dusted with powdered sugar.",
   "If your yellow cake mix already contains pudding, omit the instant pudding, use 3 eggs instead of 4, and use ⅓ cup oil instead of ½ cup."
  ],
  "ovenTemp": "325°F",
  "cookTime": "1 hour",
  "yield": null,
  "editorNotes": [
   "Glaze boiling time is cut off in the source (\"Boil for … zutes\"); probably 5 minutes, but the number is not legible."
  ]
 },
 {
  "id": "marmalade-cake",
  "title": "Marmalade Cake",
  "category": "Cakes",
  "book": "woodlands",
  "contributor": "Ron and Doris Haeberle",
  "contributorRole": "Residents",
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": "Cake",
    "items": [
     {
      "qty": "¾ cup",
      "item": "softened butter"
     },
     {
      "qty": "1 cup",
      "item": "sugar"
     },
     {
      "qty": "3",
      "item": "large eggs"
     },
     {
      "qty": "1 cup",
      "item": "orange marmalade"
     },
     {
      "qty": "1 Tbsp.",
      "item": "vanilla"
     },
     {
      "qty": "1 Tbsp.",
      "item": "grated orange rind"
     },
     {
      "qty": "3 cups",
      "item": "flour"
     },
     {
      "qty": "1½ tsp.",
      "item": "baking soda"
     },
     {
      "qty": "1 tsp.",
      "item": "salt"
     },
     {
      "qty": "½ cup",
      "item": "fresh orange juice"
     },
     {
      "qty": "½ cup",
      "item": "evaporated milk"
     },
     {
      "qty": "1 cup",
      "item": "chopped pecans"
     }
    ]
   },
   {
    "name": "Glaze",
    "items": [
     {
      "qty": "⅓ cup",
      "item": "fresh orange juice"
     },
     {
      "qty": "⅓ cup",
      "item": "sugar"
     }
    ]
   }
  ],
  "steps": [
   "Cream butter and sugar; add eggs one at a time.",
   "Stir in marmalade, orange rind and vanilla.",
   "In a separate bowl, combine flour, soda and salt. In another, combine orange juice and evaporated milk.",
   "Add the flour mixture to the butter mixture alternately with the juice mixture, beginning and ending with flour. Mix at low speed after each addition.",
   "Stir in pecans.",
   "Bake in a buttered Bundt pan at 350°F for 45 minutes, or until a tester comes out dry.",
   "Cool on a wire rack 15 minutes, then turn the cake out onto the rack.",
   "For the glaze, immediately combine orange juice and sugar in a small saucepan. Cook over medium heat, stirring often, until the sugar dissolves.",
   "Prick the cake at 1-inch intervals with a long skewer. Brush the hot glaze over the top of the warm cake.",
   "Cool completely on the wire rack."
  ],
  "tips": [
   "Ron and several other Woodlands residents read the \"Mitford\" series, in which a marmalade cake comes up throughout one of the books. Everyone was craving it afterward, so Ron found this recipe and passed it around."
  ],
  "ovenTemp": "350°F",
  "cookTime": "45 minutes",
  "yield": null,
  "editorNotes": [
   "Source prints \"Midford Series\"; this is almost certainly Jan Karon's Mitford series, which features an orange marmalade cake."
  ]
 },
 {
  "id": "milky-way-cake",
  "title": "Milky Way Cake",
  "category": "Cakes",
  "book": "woodlands",
  "contributor": "Grace and Ed Greene",
  "contributorRole": "Residents",
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": "Cake",
    "items": [
     {
      "qty": "8",
      "item": "Milky Way bars"
     },
     {
      "qty": "2 sticks",
      "item": "oleo (margarine), divided"
     },
     {
      "qty": "2 cups",
      "item": "sugar"
     },
     {
      "qty": "4",
      "item": "eggs"
     },
     {
      "qty": "½ tsp.",
      "item": "baking soda"
     },
     {
      "qty": "1¼ cups",
      "item": "buttermilk"
     },
     {
      "qty": "2½ cups",
      "item": "flour"
     },
     {
      "qty": "1 cup",
      "item": "chopped pecans"
     }
    ]
   },
   {
    "name": "Icing",
    "items": [
     {
      "qty": "2½ cups",
      "item": "sugar"
     },
     {
      "qty": "1 cup",
      "item": "evaporated milk"
     },
     {
      "qty": "1 stick",
      "item": "oleo (margarine)"
     },
     {
      "qty": "1 cup",
      "item": "chocolate chips"
     },
     {
      "qty": "1 cup",
      "item": "marshmallow cream"
     }
    ]
   }
  ],
  "steps": [
   "Melt the Milky Way bars with 1 stick of oleo; set aside until the end.",
   "In a large bowl, cream sugar and the remaining oleo. Add eggs.",
   "Mix soda into the buttermilk, then add the buttermilk mixture alternately with the flour.",
   "Add the melted Milky Way mixture and the pecans.",
   "Bake in a tube pan at 325°F for 1 hour 10 minutes.",
   "For the icing, cook sugar and evaporated milk to the soft-ball stage.",
   "Add chocolate chips and oleo and stir until melted."
  ],
  "tips": [],
  "ovenTemp": "325°F",
  "cookTime": "1 hour 10 minutes",
  "yield": null,
  "editorNotes": [
   "Marshmallow cream is listed in the icing but never used in the method (probably stirred in with the chocolate chips)."
  ]
 },
 {
  "id": "pumpkin-cake",
  "title": "Pumpkin Cake",
  "category": "Cakes",
  "book": "woodlands",
  "contributor": "Jean Coffey",
  "contributorRole": "Resident",
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": "Cake",
    "items": [
     {
      "qty": "2 cups",
      "item": "flour"
     },
     {
      "qty": "2 tsp.",
      "item": "baking soda"
     },
     {
      "qty": "2 tsp.",
      "item": "cinnamon"
     },
     {
      "qty": "½ tsp.",
      "item": "salt"
     },
     {
      "qty": "4",
      "item": "eggs"
     },
     {
      "qty": "2 cups",
      "item": "sugar"
     },
     {
      "qty": "1 cup",
      "item": "oil"
     },
     {
      "qty": "½ cup",
      "item": "nuts"
     },
     {
      "qty": "2 cups",
      "item": "pumpkin"
     }
    ]
   },
   {
    "name": "Frosting",
    "items": [
     {
      "qty": "2 (3 oz.) pkgs.",
      "item": "cream cheese"
     },
     {
      "qty": "1 Tbsp.",
      "item": "softened butter"
     },
     {
      "qty": "1 tsp.",
      "item": "vanilla"
     },
     {
      "qty": "1 box",
      "item": "confectioners' sugar"
     }
    ]
   }
  ],
  "steps": [
   "Sift together flour, soda, cinnamon and salt.",
   "In a separate bowl, cream together eggs and sugar. Add the flour mixture.",
   "Add oil, nuts and pumpkin.",
   "Bake in a tube pan at 350°F for 1 hour.",
   "For the frosting, cream all frosting ingredients together well."
  ],
  "tips": [],
  "ovenTemp": "350°F",
  "cookTime": "1 hour",
  "yield": null,
  "editorNotes": []
 },
 {
  "id": "red-white-and-blueberry-salad",
  "title": "Red-White-and-Blueberry Salad",
  "category": "Salads",
  "book": "woodlands",
  "contributor": "Esther Bragg",
  "contributorRole": "Resident",
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": "Red layer",
    "items": [
     {
      "qty": "1 (3 oz.) pkg.",
      "item": "red raspberry gelatin"
     },
     {
      "qty": "2 cups",
      "item": "boiling water"
     }
    ]
   },
   {
    "name": "White layer",
    "items": [
     {
      "qty": "2 envelopes (2 Tbsp.)",
      "item": "unflavored gelatin"
     },
     {
      "qty": "½ cup",
      "item": "cold water"
     },
     {
      "qty": "1 cup",
      "item": "sugar"
     },
     {
      "qty": "1 cup",
      "item": "half-and-half"
     },
     {
      "qty": "1 (8 oz.) pkg.",
      "item": "cream cheese, softened"
     },
     {
      "qty": "1 tsp.",
      "item": "vanilla extract"
     },
     {
      "qty": "½ cup",
      "item": "chopped nuts"
     }
    ]
   },
   {
    "name": "Blue layer",
    "items": [
     {
      "qty": "1 (3 oz.) pkg.",
      "item": "black raspberry gelatin"
     },
     {
      "qty": "1 cup",
      "item": "boiling water"
     },
     {
      "qty": "1 (15 oz.) can",
      "item": "blueberries, undrained"
     }
    ]
   }
  ],
  "steps": [
   "Dissolve red raspberry gelatin in 2 cups boiling water. Pour into a 9-inch square pan and chill until firm.",
   "Soften unflavored gelatin in cold water.",
   "Combine sugar and half-and-half and heat, but do not boil. Add the softened gelatin and stir to dissolve.",
   "Add cream cheese and vanilla and beat until smooth; add nuts.",
   "Pour over the set red layer and chill until firm.",
   "Dissolve black raspberry gelatin in 1 cup boiling water. Add blueberries.",
   "Pour over the cream cheese layer."
  ],
  "tips": [
   "Cottage cheese and milk can replace the cream cheese and half-and-half, and the nuts can be left out, to lower the fat."
  ],
  "ovenTemp": null,
  "cookTime": null,
  "yield": null,
  "editorNotes": [
   "Method does not say to chill the final blue layer; presumably chill until firm before serving."
  ]
 },
 {
  "id": "250-cookie-recipe",
  "title": "$250 Cookie Recipe",
  "category": "Cookies & Bars",
  "book": "woodlands",
  "contributor": "Mary Webber",
  "contributorRole": "Office Manager",
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "2 cups",
      "item": "butter"
     },
     {
      "qty": "2 cups",
      "item": "sugar"
     },
     {
      "qty": "2 cups",
      "item": "brown sugar"
     },
     {
      "qty": "4",
      "item": "eggs"
     },
     {
      "qty": "2 tsp.",
      "item": "vanilla"
     },
     {
      "qty": "4 cups",
      "item": "flour"
     },
     {
      "qty": "5 cups",
      "item": "oatmeal, measured then blended to a fine powder"
     },
     {
      "qty": "1 tsp.",
      "item": "salt"
     },
     {
      "qty": "2 tsp.",
      "item": "baking powder"
     },
     {
      "qty": "2 tsp.",
      "item": "baking soda"
     },
     {
      "qty": "24 oz.",
      "item": "chocolate chips"
     },
     {
      "qty": "1 (8 oz.)",
      "item": "Hershey bar, grated"
     },
     {
      "qty": "3 cups",
      "item": "chopped nuts"
     }
    ]
   }
  ],
  "steps": [
   "Measure the oatmeal, then blend it in a blender to a fine powder.",
   "Cream butter and both sugars. Add eggs and vanilla.",
   "Mix in flour, oatmeal, salt, baking powder and soda.",
   "Add chocolate chips, grated Hershey bar and nuts.",
   "Roll into balls and place 2 inches apart on a cookie sheet.",
   "Bake at 375°F for 10 minutes."
  ],
  "tips": [
   "The recipe can be halved."
  ],
  "ovenTemp": "375°F",
  "cookTime": "10 minutes",
  "yield": "112 cookies",
  "editorNotes": [
   "Title printed as \"S250 Cookie Recipe\"; read as \"$250\", after the well-known urban legend."
  ]
 },
 {
  "id": "baklawa-baklava",
  "title": "Baklawa",
  "category": "Desserts",
  "book": "woodlands",
  "contributor": "Linda Sakakini",
  "contributorRole": "Resident",
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": "Pastry",
    "items": [
     {
      "qty": "2 lbs.",
      "item": "filo sheets"
     },
     {
      "qty": "2 lbs.",
      "item": "walnuts, coarsely ground"
     },
     {
      "qty": "1 cup",
      "item": "sugar"
     },
     {
      "qty": "1 Tbsp.",
      "item": "rose water"
     },
     {
      "qty": "1 lb.",
      "item": "rendered butter, melted"
     }
    ]
   },
   {
    "name": "Syrup",
    "items": [
     {
      "qty": "5 cups",
      "item": "sugar"
     },
     {
      "qty": "2½ cups",
      "item": "water"
     },
     {
      "qty": "",
      "item": "juice of ½ lemon"
     },
     {
      "qty": "1 Tbsp.",
      "item": "rose water"
     }
    ]
   }
  ],
  "steps": [
   "Make the syrup first: boil sugar and water until the syrup runs thin. Add lemon juice and rose water, then cool.",
   "Combine walnuts, sugar and rose water; set aside.",
   "Butter the bottom of a large baking tray with sides. Keep filo wrapped in waxed paper or a damp towel in the refrigerator until needed.",
   "Lay one filo sheet in the pan, fitting it to the edges, and brush with melted butter. Repeat until half the sheets are used.",
   "Spread the walnut mixture evenly over the sheets.",
   "Layer the remaining sheets on top, brushing each with butter.",
   "With a sharp knife, cut into diamond shapes.",
   "Bake at 350°F for 1 hour. Brush with more butter.",
   "Continue baking at 200°F for 1 hour 15 minutes, until the top is light gold.",
   "Pour cooled syrup over the baklawa, as much as you like."
  ],
  "tips": [
   "Pistachios may be substituted for walnuts.",
   "Linda remembers helping her mother and aunt make this for holidays. Her mother made the filo dough at midnight, and they woke at 5 a.m. to spend hours assembling the baklawa."
  ],
  "ovenTemp": "350°F, then 200°F",
  "cookTime": "2 hours 15 minutes",
  "yield": null,
  "editorNotes": [
   "Syrup step moved first so it has time to cool; the source gives the syrup recipe after the pastry."
  ]
 },
 {
  "id": "date-balls",
  "title": "Date Balls",
  "category": "Candies",
  "book": "woodlands",
  "contributor": "Mary Webber",
  "contributorRole": "Office Manager",
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "1 cup",
      "item": "sugar"
     },
     {
      "qty": "1 cup",
      "item": "chopped dates"
     },
     {
      "qty": "1 stick",
      "item": "butter"
     },
     {
      "qty": "½ cup",
      "item": "evaporated milk"
     },
     {
      "qty": "1 tsp.",
      "item": "vanilla"
     },
     {
      "qty": "2½ cups",
      "item": "Rice Krispies"
     },
     {
      "qty": "1 cup",
      "item": "chopped pecans"
     },
     {
      "qty": "",
      "item": "flaked coconut, for rolling"
     }
    ]
   }
  ],
  "steps": [
   "Combine sugar, dates, butter and evaporated milk. Bring to a boil, stirring constantly, until the dates dissolve.",
   "Add vanilla, Rice Krispies and pecans.",
   "Let cool, then drop by teaspoonfuls onto flaked coconut and roll into balls."
  ],
  "tips": [],
  "ovenTemp": null,
  "cookTime": null,
  "yield": "35 balls",
  "editorNotes": [
   "Coconut quantity not given."
  ]
 },
 {
  "id": "date-roll-candy",
  "title": "Date Roll Candy",
  "category": "Candies",
  "book": "woodlands",
  "contributor": "Margaret Hofstetter",
  "contributorRole": "Resident",
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "2 cups",
      "item": "sugar"
     },
     {
      "qty": "1 cup",
      "item": "milk"
     },
     {
      "qty": "1 pkg.",
      "item": "dates, cut fine"
     },
     {
      "qty": "1 cup",
      "item": "coconut"
     },
     {
      "qty": "1 cup",
      "item": "chopped walnuts"
     }
    ]
   }
  ],
  "steps": [
   "Cook sugar and milk to the soft-ball stage.",
   "Add dates and cook over low heat until the mixture leaves the side of the pan.",
   "Add coconut and nuts. Beat well until the mixture holds its shape.",
   "Turn out onto a damp cloth and shape into a long oval roll.",
   "Roll lengthwise and slice."
  ],
  "tips": [
   "Store in an airtight container.",
   "This candy was a Christmas tradition in Margaret's family."
  ],
  "ovenTemp": null,
  "cookTime": null,
  "yield": null,
  "editorNotes": [
   "Package size for dates not given (commonly 8 oz.)."
  ]
 },
 {
  "id": "family-favorite-oatmeal-cookies",
  "title": "Family Favorite Oatmeal Cookies",
  "category": "Cookies & Bars",
  "book": "woodlands",
  "contributor": "Dorothy Hall",
  "contributorRole": "Resident",
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "2 cups",
      "item": "packed brown sugar"
     },
     {
      "qty": "1 cup",
      "item": "shortening"
     },
     {
      "qty": "3",
      "item": "eggs"
     },
     {
      "qty": "3 cups",
      "item": "all-purpose flour"
     },
     {
      "qty": "1 tsp.",
      "item": "salt"
     },
     {
      "qty": "1 tsp.",
      "item": "baking powder"
     },
     {
      "qty": "1 tsp.",
      "item": "baking soda"
     },
     {
      "qty": "1 tsp.",
      "item": "ground cinnamon"
     },
     {
      "qty": "1 cup",
      "item": "sour milk (see tip)"
     },
     {
      "qty": "2 cups",
      "item": "rolled oats"
     },
     {
      "qty": "1 cup",
      "item": "raisins"
     },
     {
      "qty": "1 cup",
      "item": "chopped walnuts"
     }
    ]
   }
  ],
  "steps": [
   "In a large mixing bowl, cream sugar and shortening.",
   "Add eggs one at a time, mixing well after each.",
   "Combine flour, salt, baking powder, soda and cinnamon; add to the creamed mixture alternately with the sour milk.",
   "Stir in oats, raisins and nuts.",
   "Drop by heaping tablespoons onto greased cookie sheets.",
   "Bake at 350°F for about 12 minutes, until lightly browned. Remove to a cooling rack."
  ],
  "tips": [
   "To sour milk, put 1 Tbsp. white vinegar in a measuring cup and add milk to make 1 cup."
  ],
  "ovenTemp": "350°F",
  "cookTime": "About 12 minutes",
  "yield": "About 5 dozen",
  "editorNotes": []
 },
 {
  "id": "peanut-butter-dainties",
  "title": "Peanut Butter Dainties",
  "category": "Candies",
  "book": "woodlands",
  "contributor": "Ann Cruise",
  "contributorRole": "Resident",
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "1½ cups",
      "item": "chunky peanut butter"
     },
     {
      "qty": "1 lb.",
      "item": "dates, cut fine"
     },
     {
      "qty": "1 scant cup",
      "item": "chopped nuts (walnuts and pecans are both good)"
     },
     {
      "qty": "6 Tbsp.",
      "item": "melted butter (not margarine that contains water)"
     },
     {
      "qty": "2 cups",
      "item": "confectioners' sugar"
     }
    ]
   },
   {
    "name": "Coating",
    "items": [
     {
      "qty": "12 oz.",
      "item": "chocolate chips"
     },
     {
      "qty": "½ block",
      "item": "paraffin (or use chocolate wafers with no paraffin)"
     }
    ]
   }
  ],
  "steps": [
   "Mix peanut butter, dates, nuts, butter and confectioners' sugar together.",
   "Form into balls the size of a walnut. Chill thoroughly.",
   "In a double boiler, melt chocolate chips with paraffin (or melt chocolate wafers).",
   "When melted, turn off the heat and dip the balls in chocolate.",
   "Place on wax-paper-lined cookie sheets and set in a cool place to harden."
  ],
  "tips": [
   "Don't use margarine that contains water, or the candies will be gooey."
  ],
  "ovenTemp": null,
  "cookTime": null,
  "yield": "6–7 dozen",
  "editorNotes": [
   "Paraffin (food-grade wax) was common in older candy recipes; many modern cooks substitute a little shortening or use candy-melt wafers."
  ]
 },
 {
  "id": "pecan-potato-chip-cookies",
  "title": "Pecan Potato Chip Cookies",
  "category": "Cookies & Bars",
  "book": "woodlands",
  "contributor": "Ann Cruise",
  "contributorRole": "Resident",
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "1 cup",
      "item": "margarine (not soft or spread type)"
     },
     {
      "qty": "½ cup",
      "item": "sugar"
     },
     {
      "qty": "1 tsp.",
      "item": "vanilla"
     },
     {
      "qty": "2 cups",
      "item": "flour"
     },
     {
      "qty": "½ cup",
      "item": "chopped pecans"
     },
     {
      "qty": "½ cup",
      "item": "crushed potato chips"
     },
     {
      "qty": "",
      "item": "granulated sugar for topping (colored sugars for holidays)"
     }
    ]
   }
  ],
  "steps": [
   "Cream margarine and sugar. Add all other ingredients and mix well.",
   "Use ungreased pans or line with parchment paper.",
   "Form dough into small balls. Press down with the bottom of a small glass dipped in granulated sugar.",
   "Bake at 350°F for 16–18 minutes."
  ],
  "tips": [
   "No eggs in this recipe.",
   "These cookies freeze well."
  ],
  "ovenTemp": "350°F",
  "cookTime": "16–18 minutes",
  "yield": "About 6 dozen",
  "editorNotes": [
   "Title printed as \"Lecan\"; read as \"Pecan\".",
   "Pecans printed as \"/½ c.\"; ½ cup is a best guess."
  ]
 },
 {
  "id": "something-on-a-ritz",
  "title": "Something on a Ritz",
  "category": "Appetizers & Snacks",
  "book": "woodlands",
  "contributor": "Mary Webber",
  "contributorRole": "Office Manager",
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "1 can",
      "item": "Eagle Brand sweetened condensed milk"
     },
     {
      "qty": "1 cup",
      "item": "chopped dates"
     },
     {
      "qty": "1 cup",
      "item": "chopped nuts"
     },
     {
      "qty": "",
      "item": "Ritz crackers"
     }
    ]
   },
   {
    "name": "Frosting",
    "items": [
     {
      "qty": "2½ cups",
      "item": "powdered sugar"
     },
     {
      "qty": "1 tsp.",
      "item": "vanilla"
     },
     {
      "qty": "2 (3 oz.) pkgs.",
      "item": "cream cheese"
     }
    ]
   }
  ],
  "steps": [
   "Cook milk and dates over low heat until soft, stirring often. Add the chopped nuts.",
   "Spread the mixture on Ritz crackers and bake for 5 minutes.",
   "Mix the frosting ingredients and spread on the crackers once cooled."
  ],
  "tips": [],
  "ovenTemp": null,
  "cookTime": "5 minutes",
  "yield": null,
  "editorNotes": [
   "Oven temperature is missing in the source (\"bake at degrees\")."
  ]
 },
 {
  "id": "magic-fruit-cake",
  "title": "Magic Fruit Cake",
  "category": "Cakes",
  "book": "willis",
  "contributor": "Mrs. Floyd Scarboro",
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": null,
    "items": [
     {
      "qty": "2 cups",
      "item": "chopped pecans"
     },
     {
      "qty": "2 cups",
      "item": "chopped English walnuts"
     },
     {
      "qty": "2 cups",
      "item": "chopped candied cherries"
     },
     {
      "qty": "2 cups",
      "item": "chopped dates"
     },
     {
      "qty": "1 cup",
      "item": "white raisins"
     },
     {
      "qty": "8 rings",
      "item": "candied pineapple"
     },
     {
      "qty": "2 cans",
      "item": "Baker's coconut"
     },
     {
      "qty": "2 cans",
      "item": "Eagle Brand sweetened condensed milk"
     }
    ]
   }
  ],
  "steps": [
   "Mix all ingredients together.",
   "Grease a 9- or 10-inch tube pan and line with wax paper (not needed with a Teflon pan).",
   "Bake at 300°F for 2 hours."
  ],
  "tips": [],
  "ovenTemp": "300°F",
  "cookTime": "2 hours",
  "yield": null,
  "editorNotes": []
 },
 {
  "id": "swedish-crumb-cake",
  "title": "Swedish Crumb Cake",
  "category": "Cakes",
  "book": "willis",
  "contributor": null,
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": "Cake",
    "items": [
     {
      "qty": "½ cup",
      "item": "Crisco"
     },
     {
      "qty": "2 scant cups",
      "item": "sugar"
     },
     {
      "qty": "2",
      "item": "eggs"
     },
     {
      "qty": "1½ cups",
      "item": "buttermilk"
     },
     {
      "qty": "1 tsp.",
      "item": "baking soda"
     },
     {
      "qty": "1 tsp.",
      "item": "baking powder"
     },
     {
      "qty": "3 cups",
      "item": "flour"
     },
     {
      "qty": "1 tsp.",
      "item": "vanilla"
     },
     {
      "qty": "1 cup",
      "item": "dates"
     },
     {
      "qty": "2 cups",
      "item": "nuts"
     }
    ]
   },
   {
    "name": "Topping (per pan)",
    "items": [
     {
      "qty": "3 Tbsp.",
      "item": "flour"
     },
     {
      "qty": "6 Tbsp.",
      "item": "brown sugar"
     },
     {
      "qty": "",
      "item": "butter, for dotting"
     }
    ]
   }
  ],
  "steps": [
   "Cream sugar and Crisco. Add eggs, then the sifted dry ingredients and milk.",
   "Stir in nuts and dates.",
   "Pour into three greased 9-inch pie pans.",
   "Mix 3 Tbsp. flour with 6 Tbsp. brown sugar for each pan, sprinkle evenly over the batter and dot with butter.",
   "Bake at 350°F for 30 minutes."
  ],
  "tips": [
   "Freezes well."
  ],
  "ovenTemp": "350°F",
  "cookTime": "30 minutes",
  "yield": "3 nine-inch cakes",
  "editorNotes": [
   "Ingredient lines are cut off in the source: \"2 scant cups\" (sugar assumed from the method), \"1-1/2 cups bu…\" (buttermilk assumed; method says \"milk\"), \"1 Tsp Baking…\" (baking powder assumed).",
   "Vanilla is listed but not mentioned in the method."
  ]
 },
 {
  "id": "apple-butter-spice-cake-2",
  "title": "Apple Butter Spice Cake",
  "category": "Cakes",
  "book": "willis",
  "contributor": null,
  "contributorRole": null,
  "city": null,
  "state": null,
  "ingredientGroups": [
   {
    "name": "Cake",
    "items": [
     {
      "qty": "2 cups",
      "item": "sifted flour"
     },
     {
      "qty": "1 tsp.",
      "item": "baking powder"
     },
     {
      "qty": "1 tsp.",
      "item": "baking soda"
     },
     {
      "qty": "½ tsp.",
      "item": "salt"
     },
     {
      "qty": "½ cup",
      "item": "butter or margarine"
     },
     {
      "qty": "1 cup",
      "item": "sugar"
     },
     {
      "qty": "2",
      "item": "eggs"
     },
     {
      "qty": "¾ cup",
      "item": "apple butter"
     },
     {
      "qty": "1 tsp.",
      "item": "vanilla"
     },
     {
      "qty": "½ cup",
      "item": "quick-cooking oats"
     },
     {
      "qty": "1 cup",
      "item": "sour cream"
     }
    ]
   },
   {
    "name": "Topping",
    "items": [
     {
      "qty": "½ cup",
      "item": "firmly packed brown sugar"
     },
     {
      "qty": "1 tsp.",
      "item": "cinnamon"
     },
     {
      "qty": "½ tsp.",
      "item": "nutmeg"
     },
     {
      "qty": "½ cup",
      "item": "chopped walnuts"
     }
    ]
   }
  ],
  "steps": [
   "Sift together flour, baking powder, soda and salt.",
   "Blend butter and sugar. Add eggs and beat well.",
   "Stir in apple butter, vanilla and oats.",
   "Add the dry ingredients alternately with the sour cream, blending well after each addition. Begin and end with dry ingredients.",
   "Combine the topping ingredients.",
   "Pour half the batter into a greased 13 x 9-inch pan and sprinkle with half the topping.",
   "Add the remaining batter and sprinkle the rest of the topping over it.",
   "Bake at 350°F for 40 minutes."
  ],
  "tips": [
   "Serve warm or cold."
  ],
  "ovenTemp": "350°F",
  "cookTime": "40 minutes",
  "yield": null,
  "editorNotes": [
   "This text may continue past the end of the PDF extract. Chunk 5 also opens with an Apple Butter Spice Cake; check whether this is a duplicate before publishing."
  ]
 }
];
