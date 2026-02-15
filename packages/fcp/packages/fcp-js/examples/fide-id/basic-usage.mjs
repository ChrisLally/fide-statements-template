import { calculateFideId } from "../../dist/index.js";

const fideId = await calculateFideId("Person", "Product", "https://x.com/alice");

console.log(fideId);
