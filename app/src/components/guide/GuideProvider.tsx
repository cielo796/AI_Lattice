"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/shared/Button";
import { Icon } from "@/components/shared/Icon";
import { cn } from "@/lib/cn";
import {
  GUIDE_ANCHOR_ATTRIBUTE,
  getGuideTourById,
  getGuideTourForPathname,
  getVisibleGuideSteps,
  type GuideStep,
  type GuideTour,
} from "@/lib/guide-registry";
import { useGuideStore } from "@/stores/guideStore";

interface GuideContextValue {
  hasCurrentTour: boolean;
  currentTourLabel?: string;
  startCurrentTour: () => void;
}

interface ActiveGuideStep extends GuideStep {
  indexLabel: string;
}

interface ElementRect {
  top: number;
  left: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
}

const GuideContext = createContext<GuideContextValue>({
  hasCurrentTour: false,
  startCurrentTour: () => undefined,
});

function isHTMLElement(element: Element | null): element is HTMLElement {
  return element instanceof HTMLElement;
}

function isElementVisible(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);

  return (
    rect.width > 0 &&
    rect.height > 0 &&
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    style.opacity !== "0"
  );
}

function findVisibleElement(selector: string) {
  const elements = Array.from(document.querySelectorAll(selector));
  return elements.find((element): element is HTMLElement => {
    return isHTMLElement(element) && isElementVisible(element);
  }) ?? null;
}

function collectVisibleGuideAnchors() {
  const anchors = new Set<string>();
  document.querySelectorAll(`[${GUIDE_ANCHOR_ATTRIBUTE}]`).forEach((element) => {
    if (!isHTMLElement(element) || !isElementVisible(element)) {
      return;
    }

    const name = element.getAttribute(GUIDE_ANCHOR_ATTRIBUTE);
    if (name) {
      anchors.add(name);
    }
  });

  return anchors;
}

function getElementRect(element: HTMLElement): ElementRect {
  const rect = element.getBoundingClientRect();
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
    right: rect.right,
    bottom: rect.bottom,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getPopoverStyle(
  rect: ElementRect | null,
  step: GuideStep | undefined
): CSSProperties {
  if (!rect || !step || typeof window === "undefined") {
    return {
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
    };
  }

  const margin = 16;
  const gap = 12;
  const width = Math.min(360, window.innerWidth - margin * 2);
  const heightEstimate = 220;
  const placement = window.innerWidth < 640 ? "bottom" : step.placement ?? "bottom";

  if (window.innerWidth < 640) {
    return {
      bottom: margin,
      left: margin,
      right: margin,
    };
  }

  if (placement === "center") {
    return {
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
      width,
    };
  }

  const centeredLeft = clamp(
    rect.left + rect.width / 2 - width / 2,
    margin,
    window.innerWidth - width - margin
  );

  if (placement === "top") {
    return {
      left: centeredLeft,
      top: clamp(rect.top - heightEstimate - gap, margin, window.innerHeight - heightEstimate - margin),
      width,
    };
  }

  if (placement === "left") {
    return {
      left: clamp(rect.left - width - gap, margin, window.innerWidth - width - margin),
      top: clamp(rect.top + rect.height / 2 - heightEstimate / 2, margin, window.innerHeight - heightEstimate - margin),
      width,
    };
  }

  if (placement === "right") {
    return {
      left: clamp(rect.right + gap, margin, window.innerWidth - width - margin),
      top: clamp(rect.top + rect.height / 2 - heightEstimate / 2, margin, window.innerHeight - heightEstimate - margin),
      width,
    };
  }

  return {
    left: centeredLeft,
    top: clamp(rect.bottom + gap, margin, window.innerHeight - heightEstimate - margin),
    width,
  };
}

function getHighlightStyle(rect: ElementRect | null): CSSProperties {
  if (!rect) {
    return { display: "none" };
  }

  const padding = 6;
  return {
    left: rect.left - padding,
    top: rect.top - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  };
}

function resolveTourSteps(tour: GuideTour | null) {
  if (!tour) {
    return [];
  }

  return getVisibleGuideSteps(tour, collectVisibleGuideAnchors());
}

export function useGuideLauncher() {
  return useContext(GuideContext);
}

export function GuideProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const activeTourId = useGuideStore((state) => state.activeTourId);
  const stepIndex = useGuideStore((state) => state.stepIndex);
  const isOpen = useGuideStore((state) => state.isOpen);
  const completedTourIds = useGuideStore((state) => state.completedTourIds);
  const promptedTourIds = useGuideStore((state) => state.promptedTourIds);
  const startTour = useGuideStore((state) => state.startTour);
  const setStepIndex = useGuideStore((state) => state.setStepIndex);
  const closeTour = useGuideStore((state) => state.closeTour);
  const completeTour = useGuideStore((state) => state.completeTour);
  const skipTour = useGuideStore((state) => state.skipTour);
  const markTourPrompted = useGuideStore((state) => state.markTourPrompted);

  const [activeSteps, setActiveSteps] = useState<GuideStep[]>([]);
  const [targetRect, setTargetRect] = useState<ElementRect | null>(null);
  const [introTour, setIntroTour] = useState<GuideTour | null>(null);
  const currentTour = useMemo(() => getGuideTourForPathname(pathname), [pathname]);
  const activeTour = useMemo(() => getGuideTourById(activeTourId), [activeTourId]);

  const startResolvedTour = useCallback(
    (tour: GuideTour | null) => {
      if (!tour) {
        return;
      }

      const steps = resolveTourSteps(tour);
      if (steps.length === 0) {
        return;
      }

      setIntroTour(null);
      setActiveSteps(steps);
      markTourPrompted(tour.id);
      startTour(tour.id);
    },
    [markTourPrompted, startTour]
  );

  const startCurrentTour = useCallback(() => {
    startResolvedTour(getGuideTourForPathname(pathname));
  }, [pathname, startResolvedTour]);

  useEffect(() => {
    setIntroTour(null);
    if (isOpen) {
      closeTour();
    }
    setActiveSteps([]);
    setTargetRect(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (!currentTour || isOpen) {
      return;
    }

    if (
      completedTourIds.includes(currentTour.id) ||
      promptedTourIds.includes(currentTour.id)
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      const steps = resolveTourSteps(currentTour);
      if (steps.length === 0) {
        return;
      }

      markTourPrompted(currentTour.id);
      setIntroTour(currentTour);
    }, 900);

    return () => window.clearTimeout(timer);
  }, [
    completedTourIds,
    currentTour,
    isOpen,
    markTourPrompted,
    promptedTourIds,
    pathname,
  ]);

  useEffect(() => {
    if (!isOpen || !activeTour) {
      return;
    }

    if (activeSteps.length === 0) {
      setActiveSteps(resolveTourSteps(activeTour));
    }
  }, [activeSteps.length, activeTour, isOpen]);

  const currentStep = activeSteps[stepIndex];
  const decoratedStep = useMemo<ActiveGuideStep | null>(
    () =>
      currentStep
        ? {
            ...currentStep,
            indexLabel: `${stepIndex + 1} / ${activeSteps.length}`,
          }
        : null,
    [activeSteps.length, currentStep, stepIndex]
  );

  const finishTour = useCallback(() => {
    if (activeTourId) {
      completeTour(activeTourId);
    } else {
      closeTour();
    }
    setActiveSteps([]);
    setTargetRect(null);
  }, [activeTourId, closeTour, completeTour]);

  const skipActiveTour = useCallback(() => {
    if (activeTourId) {
      skipTour(activeTourId);
    } else {
      closeTour();
    }
    setActiveSteps([]);
    setTargetRect(null);
  }, [activeTourId, closeTour, skipTour]);

  const goNext = useCallback(() => {
    if (stepIndex >= activeSteps.length - 1) {
      finishTour();
      return;
    }

    setStepIndex(stepIndex + 1);
  }, [activeSteps.length, finishTour, setStepIndex, stepIndex]);

  const goPrevious = useCallback(() => {
    setStepIndex(Math.max(0, stepIndex - 1));
  }, [setStepIndex, stepIndex]);

  useEffect(() => {
    if (!isOpen || !decoratedStep) {
      setTargetRect(null);
      return;
    }

    const step = decoratedStep;
    let disposed = false;
    let measureTimer: number | undefined;

    function measureTarget() {
      const element = findVisibleElement(step.selector);
      if (!element) {
        if (stepIndex >= activeSteps.length - 1) {
          finishTour();
          return;
        }
        setStepIndex(stepIndex + 1);
        return;
      }

      element.scrollIntoView({
        block: "center",
        inline: "nearest",
        behavior: "smooth",
      });

      measureTimer = window.setTimeout(() => {
        if (!disposed) {
          setTargetRect(getElementRect(element));
        }
      }, 180);
    }

    measureTarget();
    window.addEventListener("resize", measureTarget);
    window.addEventListener("scroll", measureTarget, true);

    return () => {
      disposed = true;
      if (measureTimer) {
        window.clearTimeout(measureTimer);
      }
      window.removeEventListener("resize", measureTarget);
      window.removeEventListener("scroll", measureTarget, true);
    };
  }, [
    activeSteps.length,
    decoratedStep,
    finishTour,
    isOpen,
    setStepIndex,
    stepIndex,
  ]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        skipActiveTour();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, skipActiveTour]);

  const contextValue = useMemo<GuideContextValue>(
    () => ({
      hasCurrentTour: Boolean(currentTour),
      currentTourLabel: currentTour?.label,
      startCurrentTour,
    }),
    [currentTour, startCurrentTour]
  );

  return (
    <GuideContext.Provider value={contextValue}>
      {children}

      {introTour && !isOpen && (
        <div data-guide="guide-invitation" className="fixed bottom-4 right-4 z-[70] w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-outline-variant bg-surface p-4 shadow-[0_8px_24px_rgba(15,23,42,0.18)]">
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-container text-primary">
              <Icon name="school" size="sm" />
            </span>
            <div>
              <div className="text-sm font-bold text-on-surface">
                {introTour.label}の手順を案内します
              </div>
              <div className="text-[11px] text-on-surface-variant">
                初回だけ表示される初心者向けガイドです。
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIntroTour(null)}
            >
              あとで
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => startResolvedTour(introTour)}
            >
              <Icon name="play_arrow" size="sm" />
              案内を見る
            </Button>
          </div>
        </div>
      )}

      {isOpen && decoratedStep && (
        <div aria-live="polite">
          <div className="pointer-events-none fixed inset-0 z-[60] bg-black/20" />
          <div
            className="pointer-events-none fixed z-[61] rounded-xl border-2 border-primary bg-transparent shadow-[0_0_0_9999px_rgba(15,23,42,0.22),0_0_0_6px_rgba(240,106,106,0.18)] transition-all duration-150"
            style={getHighlightStyle(targetRect)}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-label={decoratedStep.title}
            className={cn(
              "fixed z-[70] rounded-xl border border-outline-variant bg-surface p-4 shadow-[0_12px_30px_rgba(15,23,42,0.22)]",
              "w-[min(22.5rem,calc(100vw-2rem))]"
            )}
            style={getPopoverStyle(targetRect, decoratedStep)}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                  初心者ガイド {decoratedStep.indexLabel}
                </div>
                <h2 className="font-headline text-base font-bold tracking-tight text-on-surface">
                  {decoratedStep.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={skipActiveTour}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                aria-label="ガイドを閉じる"
              >
                <Icon name="close" size="sm" />
              </button>
            </div>

            <p className="text-[13px] leading-relaxed text-on-surface-variant">
              {decoratedStep.body}
            </p>

            <div className="mt-4 flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={skipActiveTour}
              >
                スキップ
              </Button>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={goPrevious}
                  disabled={stepIndex === 0}
                >
                  <Icon name="chevron_left" size="sm" />
                  戻る
                </Button>
                <Button type="button" size="sm" onClick={goNext}>
                  {stepIndex >= activeSteps.length - 1 ? (
                    <>
                      <Icon name="check" size="sm" />
                      完了
                    </>
                  ) : (
                    <>
                      次へ
                      <Icon name="chevron_right" size="sm" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </section>
        </div>
      )}
    </GuideContext.Provider>
  );
}
