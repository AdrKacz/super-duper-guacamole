const Color = {
  light: 'rgb(242, 242, 247)',
  white: 'rgb(255, 255, 255)',
  dark: 'rgb(28, 28, 30)',
  black: 'rgb(0, 0, 0)',
  placeholderDarkMode: 'rgb(169, 169, 174)',
  placeholder: 'rgb(137, 137, 141)',
};

let CurrentColor = {
  backgroundColor: Color.light,
  interactiveColor: Color.white,
  textColor: Color.black,
  placeholderColor: Color.placeholder
};

export function setColor(key, color_key) {
  CurrentColor[key] = Color[color_key];
}

export default function getColor(key) {
  return CurrentColor[key];
}
