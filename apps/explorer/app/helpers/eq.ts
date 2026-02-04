import Helper from "@ember/component/helper";

interface EqSignature {
  Args: {
    Positional: [unknown, unknown];
  };
  Return: boolean;
}

export default class Eq extends Helper<EqSignature> {
  compute([a, b]: [unknown, unknown]): boolean {
    return a === b;
  }
}
