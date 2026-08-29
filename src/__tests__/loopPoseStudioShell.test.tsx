/**
 * The Pose Studio front door — who is offered studio mode, and whether the
 * copy tells the truth about what a take will be.
 *
 * The previous mechanism was a hidden `?studio=1` URL flag with a hardcoded
 * "60s clip, full HD" subtitle that drifted from the real limits and gave no
 * signal about whether it had taken effect at all.
 */
import { render, screen, fireEvent } from "@testing-library/react";
import PoseStudioShell from "@/components/loop/pose/PoseStudioShell";
import { CLIP_LIMITS } from "@/lib/loop/pose/limits";

jest.mock("@/components/loop/pose/CameraSheet", () => ({
  __esModule: true,
  default: ({ studio }: { studio?: boolean }) => (
    <div data-testid="camera-sheet" data-studio={studio ? "on" : "off"} />
  ),
}));
jest.mock("@/components/loop/wall/WallGallery", () => ({
  __esModule: true,
  default: () => <div data-testid="wall" />,
}));

describe("PoseStudioShell", () => {
  it("never offers studio mode to a guest", () => {
    render(<PoseStudioShell />);
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.getByText(`Photo or ${CLIP_LIMITS.guest}s clip`)).toBeInTheDocument();
  });

  it("offers it to an admin, off by default", () => {
    render(<PoseStudioShell isAdmin />);
    const toggle = screen.getByRole("switch");
    expect(toggle).toHaveAttribute("aria-checked", "false");
    // Off by default matters: studio costs frame rate, so it must be a choice.
    expect(screen.getByText(`Photo or ${CLIP_LIMITS.guest}s clip`)).toBeInTheDocument();
  });

  it("states both studio limits once switched on — filtered AND raw", () => {
    render(<PoseStudioShell isAdmin />);
    fireEvent.click(screen.getByRole("switch"));
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
    // Both numbers, because which one you get depends on the filter.
    expect(
      screen.getByText(
        `Studio · photo, ${CLIP_LIMITS.studioFiltered}s filtered or ${
          CLIP_LIMITS.studioRaw / 60
        } min raw`,
      ),
    ).toBeInTheDocument();
  });

  it("passes studio through to the camera", () => {
    render(<PoseStudioShell isAdmin />);
    fireEvent.click(screen.getByRole("switch"));
    fireEvent.click(screen.getByRole("button", { name: /open the camera/i }));
    expect(screen.getByTestId("camera-sheet")).toHaveAttribute("data-studio", "on");
  });
});
