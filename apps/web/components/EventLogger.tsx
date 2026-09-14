"use client";

import EventForm from "@/components/EventForm";

/** Thin client wrapper so the (server) Events page can embed the create form. */
export default function EventLogger() {
  return <EventForm mode="create" />;
}
