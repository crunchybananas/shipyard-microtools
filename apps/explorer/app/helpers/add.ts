import Helper from "@ember/component/helper";

interface AddSignature {
  Args: {
    Positional: [number, number];
  };
  Return: number;
}

export default class Add extends Helper<AddSignature> {
  compute([a, b]: [number, number]): number {
    return a + b;
  }
}
