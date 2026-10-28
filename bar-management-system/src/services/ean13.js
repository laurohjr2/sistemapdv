const checkDigit = (digits) =>
  String(
    (10 -
      ([...digits].reduce((sum, n, i) => sum + Number(n) * (i % 2 ? 3 : 1), 0) %
        10)) %
      10,
  );
const valid = (code) =>
  typeof code === "string" &&
  /^\d{13}$/.test(code) &&
  checkDigit(code.slice(0, 12)) === code[12];
const left = [
  "0001101",
  "0011001",
  "0010011",
  "0111101",
  "0100011",
  "0110001",
  "0101111",
  "0111011",
  "0110111",
  "0001011",
];
const even = [
  "0100111",
  "0110011",
  "0011011",
  "0100001",
  "0011101",
  "0111001",
  "0000101",
  "0010001",
  "0001001",
  "0010111",
];
const parity = [
  "LLLLLL",
  "LLGLGG",
  "LLGGLG",
  "LLGGGL",
  "LGLLGG",
  "LGGLLG",
  "LGGGLL",
  "LGLGLG",
  "LGLGGL",
  "LGGLGL",
];
function bits(code) {
  if (!valid(code)) return null;
  let result = "101";
  for (let i = 1; i <= 6; i++)
    result += (parity[Number(code[0])][i - 1] === "L" ? left : even)[
      Number(code[i])
    ];
  result += "01010";
  for (let i = 7; i < 13; i++)
    result += left[Number(code[i])].replace(/[01]/g, (n) =>
      n === "0" ? "1" : "0",
    );
  return result + "101";
}
module.exports = { checkDigit, valid, bits };
