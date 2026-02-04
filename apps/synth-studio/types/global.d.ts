// Extend HTMLInputElement to support non-standard 'orient' attribute
// This is used for vertical range sliders (Firefox natively, others via CSS)
declare global {
  interface HTMLInputElement {
    orient?: "horizontal" | "vertical";
  }
}

export {};
