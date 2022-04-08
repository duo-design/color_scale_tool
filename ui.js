const querySelector = document.querySelector.bind(document);

const tag = (tagName, content, attributes={}) => {
  const element = document.createElement(tagName);
  if (content) {
    if ((typeof content) === "string") {
      element.innerHTML = content;
    } else {
      element.append(content);
    }
  }
  return addAttributes(element, attributes);
};

const addAttributes = (element, attributes) => {
  Object
    .entries(attributes)
    .forEach(([name, value]) => element.setAttribute(name, value));

  return element;
};

const toSRGB = (color) => {
  const satFixed = culori.converter("rgb")(
    (color.mode === "okhsl" && color.l === 0) ?
      Object.assign({}, color, {s: 0}) :
      color
  );

  // Sometimes the converter returns very small negative values which breaks
  // most things that expect the value to always be between 1 and 0.
  const clamp = (number) => Math.max(0, Math.min(1, number));
  return Object.assign(
    {},
    satFixed,
    {r: clamp(satFixed.r), g: clamp(satFixed.g), b: clamp(satFixed.b)}
  );
};

const getAbsLc = (textColor, bgColor) => {
  const textSRGB = toSRGB(textColor);
  const bgSRGB = toSRGB(bgColor);

  const scale = (value) => value * 255;
  const textY = sRGBtoY(
    [scale(textSRGB.r), scale(textSRGB.g), scale(textSRGB.b)]
  );
  const bgY = sRGBtoY(
    [scale(bgSRGB.r), scale(bgSRGB.g), scale(bgSRGB.b)]
  );

  return  Math.abs(APCAcontrast(textY, bgY));
};

const WHITE = culori.converter("rgb")("white");
const BLACK = culori.converter("rgb")("black");

const A11Y_TESTS = [
  {
    longName: "Disabled text",
    shortName: "Disabled <br> text",
    size: "14px",
    apca: 30,
    wcag2: -1
  },
  {
    longName: "Lines that must be seen",
    shortName: "Lines",
    size: "14px",
    apca: 30,
    wcag2: 3
  },
  {
    longName: "Solid icons",
    shortName: "<strong>Solid <br> icons</strong>",
    size: "24px",
    apca: 60,
    wcag2: 3
  },
  {
    longName: "Outlined icons",
    shortName: "Outlined <br> icons",
    size: "16px",
    apca: 75,
    wcag2: 3
  },
  {
    longName: "36px bold or 72px normal",
    shortName: "<strong>36 bold</strong> 72 normal",
    size: "14px",
    apca: 60,
    apcaMax: 90,
    wcag2: -1
  },
  {
    longName: "24px bold",
    shortName: "<strong>24 bold</strong>",
    size: "24px",
    apca: 60,
    wcag2: 3
  },
  {
    longName: "18px bold, 24px normal",
    shortName: "<strong>18 bold</strong> 24 normal",
    size: "24px",
    apca: 65,
    wcag2: 4.5
  },
  {
    longName: "14-16px bold, outlined icons",
    shortName: "<strong>14 bold</strong> <strong>16 bold</strong>",
    size: "16px",
    apca: 75,
    wcag2: 4.5
  },
  {
    longName: "18px",
    shortName: "18",
    size: "18px",
    apca: 75,
    wcag2: 4.5
  },
  {
    longName: "16px",
    shortName: "16",
    size: "16px",
    apca: 85,
    wcag2: 4.5
  },
  {
    longName: "14px",
    shortName: "14",
    size: "14px",
    apca: 95,
    wcag2: 4.5
  },
];

const DEFAULT_SCALE = {
  text: "18",
  step_count: 16,
  hue: 240,
  saturation: 20,
  dark_value: 0,
  light_value: 100,
  scale_balance: 0,
  tilt_dark: 0,
  tilt_light: 0,
  test_color_1: "#000000",
  test_color_2: "#ffffff",
  manual_scale: "#002d21 Green 1\n#005d49 Green 2\n#009072 Green 3\n#00c69d Green 4\n#00fecb Green 5",
  text_vs_background: "test-is-text",
  preview_background: "white-background",
  input_type: "sliders"
};

const SCALE = DEFAULT_SCALE;

const getDarkestOkHSL = () => {
  return {
    mode: "okhsl",
    h: SCALE.hue,
    s: (SCALE.saturation / 100),
    l: (SCALE.dark_value / 100)
  };
};

const getLightestOkHSL = () => {
  return {
    mode: "okhsl",
    h: SCALE.hue,
    s: (SCALE.saturation / 100),
    l: (SCALE.light_value / 100)
  };
};

const getStep = (step) => {
  const darkest = getDarkestOkHSL();
  const lightest = getLightestOkHSL();

  if (step === 0) {
    return darkest;

  } else if (step === (SCALE.step_count - 1)) {
    return lightest;

  } else {
    const fractionFromDarkest = (1 / (SCALE.step_count - 1)) * step;
    const fractionFromLightest = 1 - fractionFromDarkest;

    const perceptualIncrement = (lightest.l - darkest.l) / (SCALE.step_count - 1);

    const perceptual = {
      mode: "okhsl",
      h: SCALE.hue,
      s: (SCALE.saturation / 100),
      l: (darkest.l + (perceptualIncrement * step))
    }

    const minWhiteTextLc = getAbsLc(WHITE, lightest);
    const maxWhiteTextLc = getAbsLc(WHITE, darkest);

    const minBlackTextLc = getAbsLc(BLACK, darkest);
    const maxBlackTextLc = getAbsLc(BLACK, lightest);

    const whiteTextLcStep =
      (maxWhiteTextLc - minWhiteTextLc) / (SCALE.step_count - 1);
    const blackTextLcStep =
      (maxBlackTextLc - minBlackTextLc) / (SCALE.step_count - 1);

    const lightnessIncrement = 0.001;

    const targetWhiteTextLc = whiteTextLcStep * (SCALE.step_count - 1 - step);
    const targetBlackTextLc = blackTextLcStep * step;

    const lightTextOptimized = lightest;
    while (getAbsLc(WHITE, lightTextOptimized) < targetWhiteTextLc) {
      lightTextOptimized.l -= lightnessIncrement;
    }

    const darkTextOptimized = darkest;
    while (getAbsLc(BLACK, darkTextOptimized) < targetBlackTextLc) {
      darkTextOptimized.l += lightnessIncrement;
    }

    const apcaEven = Object.assign(
      {},
      darkTextOptimized,
      {
        l: (
          (lightTextOptimized.l * fractionFromDarkest) +
          (darkTextOptimized.l * fractionFromLightest)
        )
      }
    );

    const adjustedLightness = 
      (perceptual.l * ((100 - SCALE.scale_balance) / 100)) +
      (apcaEven.l * (SCALE.scale_balance / 100));

    return Object.assign(
      {},
      perceptual,
      {l: adjustedLightness}
    );
  }
};

const getRatio = (color1, color2) => {
  const rgb1 = toSRGB(color1);
  const rgb2 = toSRGB(color2);

  const luminance = ({r, g, b}) => {
    const scaled = (value) => {
      return (value <= 0.03928) ?
        (value / 12.92) :
        (((value + 0.055) / 1.055) ** 2.4);
    }

    return (
      (0.2126 * scaled(r)) +
      (0.7152 * scaled(g)) +
      (0.0722 * scaled(b))
    );
  };

  const luminances = [luminance(rgb1), luminance(rgb2)].sort((a, b) => a - b);

  return (luminances[1] + 0.05) / (luminances[0] + 0.05);
};

const createA11yPreview = ({text, background, reverse=false, invalid=false}) => {
  const results = [];

  if (invalid) {
    for (var i = A11Y_TESTS.length; i >= 0; i--) {
      results.push(tag("DIV"));
    }
  } else {
    const lc = getAbsLc(text, background);
    const ratio = getRatio(text, background);

    results.push(
      (lc >= 15) ?
        (
          tag(
            "DIV",
            `<strong>Lc ${lc.toFixed(0)}</strong> ${ratio.toFixed(1)} : 1`,
            {class: "a11y-test measurement"}
          )
        ) : (
          tag(
            "DIV",
            "Not <br> Visible",
            {class: "a11y-test measurement not-visible"}
          )
        )
    );

    A11Y_TESTS.forEach((test) => {
      const passesTest = ((lc >= test.apca) && (ratio >= test.wcag2) && (lc <= (test.apcaMax || Infinity)));

      results.push(
        tag("DIV", test.shortName, {
          class: `a11y-test ${passesTest ? "pass" : "fail"} `,
          style: `
            background-color: ${culori.formatHex(background)};
            color: ${culori.formatHex(text)};
          `
        })
      );
    });
  }

  return reverse ? results.reverse() : results;
}

const createSwatch = ({color, name=null, invalid=false}) => {
  const colorHex = culori.formatHex(color);
  const labelHex =
    (getAbsLc(WHITE, color) > getAbsLc(BLACK, color)) ? "#ffffff" : "#000000";

  const colorSwatch = tag("DIV", (invalid ? "invalid CSS" : `${name || ""} <br> ${colorHex}`), {
    class: "swatch-color",
    style: `
      background-color: ${colorHex};
      color: ${labelHex};
    `
  });

  const testColors1 = [culori.parse(SCALE.test_color_1), color];
  const testColors2 = [culori.parse(SCALE.test_color_2), color];

  if (SCALE.text_vs_background === "test-is-text") {
    testColors1.reverse();
    testColors2.reverse();
  }

  return [
    ...createA11yPreview({
      background: testColors1[0],
      text: testColors1[1],
      reverse: true,
      invalid: invalid
    }),
    colorSwatch,
    ...createA11yPreview({
      background: testColors2[0],
      text: testColors2[1],
      invalid: invalid
    }),
  ];
};

const rerenderScale = () => {
  document.body.classList.remove(
    "black-background",
    "white-background",
    "grey-background",
    "manual",
    "sliders",
  );

  document.body.classList.add(SCALE.preview_background);
  document.body.classList.add(SCALE.input_type);

  const swatches = querySelector(".swatches");
  swatches.innerHTML = "";

  if (SCALE.input_type === "manual") {
    const lines = SCALE.manual_scale.trim().split(/\s*\n\s*/);
    const strings = lines.map((line) => {
      const [color, ...name] = line.trim().split(/\s+/);
      return [color, name.join(" ")]
    });
    const colorNamePairs = strings.map(
      ([unparsed, name]) => [culori.parse(unparsed), name]
    );

    for (const [color, name] of colorNamePairs) {
      if (color) {
        swatches.append(...createSwatch({color, name}));
      } else {
        swatches.append(...createSwatch({
          color: culori.parse("#dd0022"),
          invalid: true
        }));
      }
    }
  } else { 
    for (let i = 0; i < SCALE.step_count; i++) {
      swatches.append(...createSwatch({color: getStep(i)}));
    }
  }
};

const createNumericField = (
  label,
  name,
  {min, max, syncWith, noGreaterThan, noLessThan},
  className
) => {
  const numberLabel = tag("LABEL", label, {class: className});
  const digital = tag("INPUT");
  const slider = tag("INPUT");

  const setInputAttributes = (type, input, {syncedInput, min, max}) => {
    addAttributes(
      input,
      {
        type,
        min,
        max,
        step: 1,
        value: SCALE[name],
        class: `numeric-${type} ${className}`,
        name: `${name}_${type}`
      }
    );

    if (SCALE[`is_${name}_synced`]) input.setAttribute("disabled", true);

    input.addEventListener("input", (event) => {
      const rawValue = parseInt(event.target.value);
      const smallestGap = 10;
      const constrainedValue =
        (noLessThan && ((SCALE[noLessThan] + smallestGap) >= rawValue)) ?
          SCALE[noLessThan] + smallestGap :
        (noGreaterThan && ((SCALE[noGreaterThan] - smallestGap) <= rawValue)) ?
          SCALE[noGreaterThan] - smallestGap :
          rawValue;

      syncedInput.value = constrainedValue;
      event.target.value = constrainedValue
      SCALE[name] = constrainedValue;

      rerenderScale();
    });
  };

  setInputAttributes(
    "range",
    slider,
    {
      syncedInput: digital,
      min: (min === undefined) ? 0  : min,
      max: (max === undefined) ? 50 : max
    }
  );
  setInputAttributes(
    "number",
    digital,
    {syncedInput: slider, min, max}
  );

  return [numberLabel, digital, slider];
};

const createSelector = (label, name, options, className) => {
  const selectLabel = tag("LABEL", label, {class: className});
  const select = tag("SELECT", null, {class: `select-input ${className}`});

  for (const [optionLabel, value, description] of options) {
    select.append(tag("OPTION", optionLabel, {value}));
  }

  select.addEventListener('change', (event) => {
    const {value} = event.target;
    SCALE[name] = value;
    rerenderScale();
  })

  return [selectLabel, select];
}

const createTextField = (label, name, className) => {
  const inputLabel = tag("LABEL", label, {class: className});
  const input = tag("INPUT", null, {class: `text-input ${className}`});

  input.value = SCALE[name]

  input.addEventListener('input', (event) => {
    const {value} = event.target;
    SCALE[name] = value;
    rerenderScale();
  })

  return [inputLabel, input];
}

const createTextarea = (label, name, className) => {
  const inputLabel = tag("LABEL", label, {class: className});
  const input = tag("TEXTAREA", null, {class: `text-area ${className}`});

  input.value = SCALE[name]

  input.addEventListener('input', (event) => {
    const {value} = event.target;
    SCALE[name] = value;
    rerenderScale();
  })

  return [inputLabel, input];
}

querySelector(".controls").append(
  tag("H2", "Scale settings"),

  ...createSelector(
    "Scale input type",
    "input_type",
    [
      ["Control with silders", "sliders"],
      ["Manually enter CSS colors", "manual"],
    ]
  ),

  ...createTextarea(
    "CSS values",
    "manual_scale",
    "manual-controls"
  ),

  ...createNumericField(
    "Number of colors",
    "step_count",
    {min: 3, max: 20},
    "slider-controls"
  ),

  ...createNumericField(
    "Even steps vs. even readability changes",
    "scale_balance",
    {min: 0, max: 100},
    "slider-controls"
  ),

  tag("H2", "Color", {class: "slider-controls"}),

  ...createNumericField(
    "Saturation",
    "saturation",
    {min: 0, max: 100},
    "slider-controls"
  ),

  ...createNumericField(
    "Hue",
    "hue",
    {min: 0, max: 360},
    "slider-controls"
  ),

  ...createNumericField(
    "Darkest value",
    "dark_value",
    {min: 0, max: 100, noGreaterThan: "light_value"},
    "slider-controls"
  ),

  ...createNumericField(
    "Lightest value",
    "light_value",
    {min: 0, max: 100, noLessThan: "dark_value"},
    "slider-controls"
  ),

  // tag("h2", "Tweaks"),

  // ...createNumericField(
  //   "Dark tilt",
  //   "tilt_dark",
  //   {min: -100, max: 100}
  // ),

  // ...createNumericField(
  //   "Light tilt",
  //   "tilt_light",
  //   {min: -100, max: 100}
  // ),

  tag("h2", "Preview options"),

  ...createSelector(
    "Test color use",
    "text_vs_background",
    [
      ["Test color is text", "test-is-text"],
      ["Test color is background",  "test-is-background"],
    ]
  ),

  ...createTextField("Test color 1", "test_color_1"),

  ...createTextField("Test color 2", "test_color_2"),

  ...createSelector(
    "Tool background",
    "preview_background",
    [
      ["White", "white-background"],
      ["Grey",  "grey-background"],
      ["Black", "black-background"],
    ]
  ),
);

rerenderScale();