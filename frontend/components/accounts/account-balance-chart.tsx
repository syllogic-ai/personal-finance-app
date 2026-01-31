"use client";

import { useRef, useState, useEffect } from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartConfig, ChartContainer } from "@/components/ui/chart";
import { useSpring, useMotionValueEvent } from "motion/react";
import { format, parseISO } from "date-fns";
import type { BalanceHistoryPoint } from "@/lib/actions/accounts";

interface AccountBalanceChartProps {
  data: BalanceHistoryPoint[];
  currency: string;
}

const chartConfig = {
  balance: {
    label: "Balance",
    color: "#10B981",
  },
} satisfies ChartConfig;

export function AccountBalanceChart({
  data,
  currency,
}: AccountBalanceChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [axis, setAxis] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentDate, setCurrentDate] = useState<string | null>(null);

  const springX = useSpring(0, {
    damping: 30,
    stiffness: 100,
  });
  const springY = useSpring(0, {
    damping: 30,
    stiffness: 100,
  });

  useMotionValueEvent(springX, "change", (latest) => {
    setAxis(latest);
  });

  // Initialize to full width on mount
  useEffect(() => {
    if (chartRef.current && data.length > 0) {
      const width = chartRef.current.getBoundingClientRect().width;
      springX.jump(width);
      springY.jump(data[data.length - 1].balance);
      setCurrentDate(data[data.length - 1].date);
      setIsInitialized(true);
    }
  }, [data, springX, springY]);

  const formatCurrencyValue = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Balance History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            Balance history will appear once transactions are recorded
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          Balance History (Last 90 Days)
        </CardTitle>
      </CardHeader>
      <CardContent className="relative">
        {/* Floating badge and vertical line */}
        {isInitialized && (
          <>
            {/* Vertical line */}
            <div
              className="absolute pointer-events-none"
              style={{
                left: axis,
                top: 30,
                bottom: 30,
                width: 1,
                borderLeft: "1px dashed #10B981",
                opacity: 0.5,
              }}
            />
            {/* Badge */}
            <div
              className="absolute z-10 pointer-events-none"
              style={{
                left: axis,
                top: 8,
                transform: "translateX(-100%)",
              }}
            >
              <div
                className="text-white text-xs font-semibold px-2 py-1 font-mono"
                style={{ backgroundColor: "#047857" }}
              >
                {formatCurrencyValue(springY.get())}
              </div>
              {currentDate && (
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {format(parseISO(currentDate), "MMM d")}
                </div>
              )}
            </div>
          </>
        )}

        <ChartContainer
          ref={chartRef}
          className="h-64 w-full"
          config={chartConfig}
        >
          <AreaChart
            accessibilityLayer
            data={data}
            onMouseMove={(state) => {
              const x = state.activeCoordinate?.x;
              const dataValue = state.activePayload?.[0]?.value;
              const dataDate = state.activePayload?.[0]?.payload?.date;
              if (x && dataValue !== undefined) {
                springX.set(x);
                springY.set(dataValue as number);
                if (dataDate) setCurrentDate(dataDate);
              }
            }}
            onMouseLeave={() => {
              if (chartRef.current) {
                springX.set(chartRef.current.getBoundingClientRect().width);
                springY.jump(data[data.length - 1].balance);
                setCurrentDate(data[data.length - 1].date);
              }
            }}
            margin={{ top: 30, right: 0, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient
                id="gradient-clipped-area-balance"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="5%"
                  stopColor="#10B981"
                  stopOpacity={0.3}
                />
                <stop
                  offset="95%"
                  stopColor="#10B981"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              strokeDasharray="3 3"
              horizontalCoordinatesGenerator={(props) => {
                const { height } = props;
                return [0, height - 30];
              }}
            />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={50}
              tickFormatter={(value) => format(parseISO(value), "MMM d")}
            />
            {/* Ghost line behind the graph */}
            <Area
              dataKey="balance"
              type="monotone"
              fill="none"
              stroke="#10B981"
              strokeOpacity={0.15}
              strokeWidth={2}
            />
            {/* Main animated area */}
            <Area
              dataKey="balance"
              type="monotone"
              fill="url(#gradient-clipped-area-balance)"
              fillOpacity={1}
              stroke="#10B981"
              strokeWidth={2}
              style={{
                clipPath: `inset(0 ${
                  Number(chartRef.current?.getBoundingClientRect().width || 0) - axis
                }px 0 0)`,
              }}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
