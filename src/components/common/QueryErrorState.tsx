import { ArrowClockwise } from "@phosphor-icons/react";
import { EmptyState } from "./EmptyState";
import { Button } from "../ui/button";

export function QueryErrorState({ label, onRetry }: { label: string; onRetry: () => void }) {
  return (
    <EmptyState
      icon={<ArrowClockwise className="h-5 w-5" />}
      title={`Couldn't load ${label}`}
      description="The local database did not respond."
      action={
        <Button variant="outline" size="sm" className="cursor-pointer" onClick={onRetry}>
          Retry
        </Button>
      }
    />
  );
}
