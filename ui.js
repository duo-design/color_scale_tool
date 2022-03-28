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
    name: "14px",
    size: "14px",
    weight: "normal",
    apca: 95,
    wcag2: 4.5
  },
  {
    name: "16px",
    size: "16px",
    weight: "normal",
    apca: 85,
    wcag2: 4.5
  },
  {
    name: "18px (14px bold)",
    size: "18px",
    weight: "normal",
    apca: 75,
    wcag2: 4.5
  },
  {
    name: "24px (18px bold)",
    size: "24px",
    weight: "normal",
    apca: 65,
    wcag2: 4.5
  },
  {
    name: "24px bold, buttons, inputs",
    size: "24px",
    weight: "bold",
    apca: 60,
    wcag2: 3
  },
  {
    name: "Visible (3px dividing lines, disabled text)",
    size: "14px",
    weight: "bold",
    apca: 30,
    wcag2: -1
  },
  {
    name: "Barely visible (elevations)",
    size: "14px",
    weight: "bold",
    apca: 15,
    wcag2: -1
  },
];

const DEFAULT_SCALE = {
  type: "perceptual",
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

const createA11yPreview = (textColor, bgColor, className="") => {
  const passingTests = A11Y_TESTS.filter((test) => (
    (getAbsLc(textColor, bgColor) >= test.apca) &&
    (getRatio(textColor, bgColor) >= test.wcag2)
  ));

  if (passingTests.length === 0) {
    return tag("DIV");
  } else {
    const smallestAllowed = passingTests[0];
    return tag("DIV", smallestAllowed.name, {
      class: `a11y-test ${className}`,
      style: `
        color: ${culori.formatHex(textColor)};
        background-color: ${culori.formatHex(bgColor)};
        font-weight: ${smallestAllowed.weight};
        font-size: ${smallestAllowed.size}
      `,
    });
  }
}

const createSwatch = (step) => {
  const color = getStep(step);
  const colorHex = culori.formatHex(color);
  const darkLabel = BLACK;
  const lightLabel = WHITE;
  const labelHex = culori.formatHex(
    (getAbsLc(lightLabel, color) > getAbsLc(darkLabel, color)) ?
      lightLabel :
      darkLabel
  );

  return [
    createA11yPreview(culori.parse(SCALE.test_color_1), color, "left-a11y-test"),
    tag("DIV", colorHex, {
      class: "swatch-color",
      style: `
        background-color: ${colorHex};
        color: ${labelHex};
      `
    }),
    createA11yPreview(culori.parse(SCALE.test_color_2), color,  "right-a11y-test"),
  ];
};

const rerenderScale = () => {
  document.body.classList.remove(
    "black-background",
    "white-background",
    "grey-background"
  );

  document.body.classList.add(SCALE.preview_background);

  const swatches = querySelector(".swatches");
  swatches.innerHTML = "";

  for (let i = 0; i < SCALE.step_count; i++) {
    swatches.append(...createSwatch(i));
  }
};

const createNumericField = (
  label,
  name,
  {min, max, syncWith, noGreaterThan, noLessThan}
) => {
  const numberLabel = tag("LABEL", label);
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
        class: `numeric-${type}`,
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

const createSelector = (label, name, options) => {
  const selectLabel = tag("LABEL", label);
  const select = tag("SELECT", null, {class: "select-input"});

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

const createTextField = (label, name) => {
  const inputLabel = tag("LABEL", label);
  const input = tag("INPUT", null, {class: "text-input"});

  input.value = SCALE[name]

  input.addEventListener('change', (event) => {
    const {value} = event.target;
    SCALE[name] = value;
    rerenderScale();
  })

  return [inputLabel, input];
}

querySelector(".controls").append(
  tag("H2", "Scale Type"),

  ...createNumericField(
    "Number of colors",
    "step_count",
    {min: 3, max: 30}
  ),

  ...createNumericField(
    "Visually even steps vs. even accessible options",
    "scale_balance",
    {min: 0, max: 100}
  ),

  tag("H2", "Color"),

  ...createNumericField(
    "Saturation",
    "saturation",
    {min: 0, max: 100}
  ),

  ...createNumericField(
    "Hue",
    "hue",
    {min: 0, max: 360}
  ),

  ...createNumericField(
    "Darkest value",
    "dark_value",
    {min: 0, max: 100, noGreaterThan: "light_value"}
  ),

  ...createNumericField(
    "Lightest value",
    "light_value",
    {min: 0, max: 100, noLessThan: "dark_value"}
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
    "Background",
    "preview_background",
    [
      ["Middle Grey", "grey-background"],
      ["White",       "white-background"],
      ["Black",       "black-background"],
    ]
  ),

  ...createTextField("Accessibility test color 1", "test_color_1"),

  ...createTextField("Accessibility test color 2", "test_color_2"),
);

rerenderScale();