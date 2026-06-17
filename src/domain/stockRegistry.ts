import stockConfig from "../data/stockRegistry.json";
import type { Stock } from "./types";

const freezeStock = (stock: Stock): Readonly<Stock> => Object.freeze({ ...stock });

export const stocks: readonly Readonly<Stock>[] = Object.freeze(
  stockConfig.map((stock) => freezeStock(stock))
);
