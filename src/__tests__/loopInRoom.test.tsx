/**
 * The in-room home — specifically, that a guest can find the camera AND the
 * terms of the contest their shots are entering.
 *
 * Worth a render test rather than a read: the contest explainer used to render
 * ONLY on the pre-event poster, while the ballot rendered only in the room, so
 * the people actually shooting entries never saw what the contest paid. That
 * is a wiring mistake no unit test would catch.
 */
import { render, screen, fireEvent } from "@testing-library/react";
import InRoom from "@/components/loop/portal/InRoom";

// The camera and the ballots pull in MediaPipe, framer-motion and network
// calls; none of that is what this test is about.
jest.mock("@/components/loop/pose/CameraSheet", () => ({
  __esModule: true,
  default: () => <div data-testid="camera-sheet" />,
}));
jest.mock("@/components/loop/wall/WallGallery", () => ({
  __esModule: true,
  default: () => <div data-testid="wall" />,
}));
jest.mock("@/components/loop/ballots/BallotSheet", () => ({
  __esModule: true,
  default: () => <div data-testid="ballot" />,
}));

function renderRoom() {
  return render(<InRoom sold={42} runOfShow={[]} nowLabel={null} />);
}

describe("InRoom", () => {
  it("puts the camera first and says what a shot is FOR", () => {
    renderRoom();
    expect(screen.getByRole("button", { name: /Camera/ })).toBeInTheDocument();
    // The old copy ("we'll Loop Soul it") described the filter but never said
    // the shot becomes a contest entry.
    expect(screen.getByText(/every shot enters the cover contest/i)).toBeInTheDocument();
  });

  it("opens the contest terms from inside the room", () => {
    renderRoom();
    fireEvent.click(screen.getByRole("button", { name: /how the cover contest works/i }));
    // The numbers are the whole point: a contest that names its payment reads
    // as an offer, one that doesn't reads as free labour.
    expect(screen.getByText("$50")).toBeInTheDocument();
    expect(screen.getByText("$5")).toBeInTheDocument();
  });

  it("does not send you to another page for a camera you already have", () => {
    renderRoom();
    fireEvent.click(screen.getByRole("button", { name: /how the cover contest works/i }));
    expect(screen.queryByRole("link", { name: /try the filter/i })).not.toBeInTheDocument();
  });

  it("opens the camera as a full surface", () => {
    renderRoom();
    expect(screen.queryByTestId("camera-sheet")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Camera/ }));
    expect(screen.getByTestId("camera-sheet")).toBeInTheDocument();
  });
});
