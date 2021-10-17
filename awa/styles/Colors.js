const Color = {
  light: 'rgb(242, 242, 247)',
  white: 'rgb(255, 255, 255)',
  dark: 'rgb(28, 28, 30)',
  black: 'rgb(0, 0, 0)',
};

let CurrentColor = {
  'backgroundColor': Color.light,
  'interactiveColor': Color.white,
  'textColor': Color.black,
};

export function setColor(key, color_key) {
  CurrentColor[key] = Color[color_key];
}

export default function getColor(key) {
  return CurrentColor[key];
}
