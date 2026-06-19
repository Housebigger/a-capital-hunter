import { render, screen } from "@testing-library/react";
import { SiteDisclaimer } from "./SiteDisclaimer";

it("renders the Tushare data-source disclaimer", () => {
  render(<SiteDisclaimer />);
  expect(screen.getByText(/数据来源 Tushare/)).toBeInTheDocument();
  expect(screen.getByText(/非投资建议/)).toBeInTheDocument();
});
