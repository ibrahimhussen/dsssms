import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { RoleName, AuthenticatedUser } from "../../../types/auth";

vi.mock("../AdminDashboard",        () => ({ AdminDashboard:        () => <div data-testid="admin-dashboard" /> }));
vi.mock("../DirectorDashboard",     () => ({ DirectorDashboard:     () => <div data-testid="director-dashboard" /> }));
vi.mock("../ViceDirectorDashboard", () => ({ ViceDirectorDashboard: () => <div data-testid="vice-director-dashboard" /> }));
vi.mock("../TeacherDashboard",      () => ({ TeacherDashboard:      () => <div data-testid="teacher-dashboard" /> }));
vi.mock("../StudentDashboard",      () => ({ StudentDashboard:      () => <div data-testid="student-dashboard" /> }));
vi.mock("../ParentDashboard",       () => ({ ParentDashboard:       () => <div data-testid="parent-dashboard" /> }));
vi.mock("../../../components/ui/LedgerRule", () => ({ LedgerRule: () => <hr /> }));

const mockUseAuth = vi.fn();
vi.mock("../../../context/AuthContext", () => ({ useAuth: () => mockUseAuth() }));

import { DashboardPage } from "../DashboardPage";

function makeUser(role: RoleName): AuthenticatedUser {
  return { userId: 1, username: "u", email: null, role, status: "ACTIVE", permissions: [], isTemporaryPassword: false, profilePicture: null, fullName: "Test User" };
}

function renderAs(role: RoleName) {
  mockUseAuth.mockReturnValue({ user: makeUser(role), isLoading: false, login: vi.fn(), logout: vi.fn() });
  return render(<DashboardPage />);
}

describe("DashboardPage — role routing", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders AdminDashboard for ADMIN", () => {
    renderAs("ADMIN");
    expect(screen.getByTestId("admin-dashboard")).toBeInTheDocument();
    expect(screen.queryByTestId("director-dashboard")).not.toBeInTheDocument();
  });

  it("renders DirectorDashboard for DIRECTOR", () => {
    renderAs("DIRECTOR");
    expect(screen.getByTestId("director-dashboard")).toBeInTheDocument();
  });

  it("renders ViceDirectorDashboard for VICE_DIRECTOR", () => {
    renderAs("VICE_DIRECTOR");
    expect(screen.getByTestId("vice-director-dashboard")).toBeInTheDocument();
  });

  it("renders TeacherDashboard for TEACHER", () => {
    renderAs("TEACHER");
    expect(screen.getByTestId("teacher-dashboard")).toBeInTheDocument();
  });

  it("renders StudentDashboard for STUDENT", () => {
    renderAs("STUDENT");
    expect(screen.getByTestId("student-dashboard")).toBeInTheDocument();
  });

  it("renders ParentDashboard for PARENT", () => {
    renderAs("PARENT");
    expect(screen.getByTestId("parent-dashboard")).toBeInTheDocument();
  });

  it("renders nothing when user is null (unauthenticated)", () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: false, login: vi.fn(), logout: vi.fn() });
    const { container } = render(<DashboardPage />);
    expect(container.firstChild).toBeNull();
  });

  it("shows the user fullName in the welcome heading", () => {
    renderAs("TEACHER");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Test User");
  });

  it("shows the role label in the subheading", () => {
    renderAs("STUDENT");
    expect(screen.getByText(/Student/)).toBeInTheDocument();
  });
});