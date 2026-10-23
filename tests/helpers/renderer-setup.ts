// Setup for the "renderer" Vitest project (simulated DOM): DOM matchers such as
// toBeInTheDocument, and a cleanup of rendered components after each test.
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => cleanup());
