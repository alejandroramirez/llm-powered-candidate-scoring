import { fireEvent, render, screen } from "@testing-library/react";
import HomePage from "../app/page";

describe("HomePage", () => {
	it("renders textarea and button", () => {
		render(<HomePage />);
		expect(screen.getByRole("textbox")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /generate ranking/i }),
		).toBeInTheDocument();
	});

	it("disables button when textarea is empty", () => {
		render(<HomePage />);
		const textarea = screen.getByRole("textbox");
		const button = screen.getByTitle("Generate Ranking");
		fireEvent.change(textarea, { target: { value: "" } });
		expect(button).toBeDisabled();
	});
});
