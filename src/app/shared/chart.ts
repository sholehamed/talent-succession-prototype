import { Component, ElementRef, effect, input, viewChild } from "@angular/core";
import type ApexCharts from "apexcharts";
@Component({
  selector: "app-chart",
  standalone: true,
  template:
    '<div #host class="chart-host" aria-label="نمودار داده‌های نمایشی"></div>',
})
export class Chart {
  readonly host = viewChild<ElementRef>("host");
  readonly type = input<"radar" | "bar" | "line">("bar");
  readonly categories = input<string[]>([]);
  readonly series = input<{ name: string; data: number[] }[]>([]);
  constructor() {
    effect((onCleanup) => {
      const host = this.host();
      const type = this.type(),
        categories = this.categories(),
        series = this.series();
      let chart: ApexCharts | undefined;
      let cancelled = false;
      if (host)
        import("apexcharts").then(({ default: Apex }) => {
          if (cancelled) return;
          chart = new Apex(host.nativeElement, {
            chart: {
              type,
              height: 300,
              fontFamily: "Vazirmatn, sans-serif",
              toolbar: { show: false },
              animations: { enabled: false },
            },
            series,
            colors: ["#0d8b78", "#97b9e5", "#dfac55"],
            xaxis: { categories, labels: { style: { fontSize: "11px" } } },
            yaxis: {
              min: 0,
              ...(type === "radar" ? { max: 5, tickAmount: 5 } : {}),
            },
            stroke: { width: 2 },
            dataLabels: { enabled: false },
            legend: { position: "bottom" },
            grid: { borderColor: "#edf0f4" },
            plotOptions: { bar: { borderRadius: 5, columnWidth: "35%" } },
            fill: { opacity: type === "radar" ? 0.17 : 1 },
            tooltip: {
              y: {
                formatter: (v: number) =>
                  v.toLocaleString("fa-IR", { maximumFractionDigits: 1 }),
              },
            },
          });
          chart.render();
        });
      onCleanup(() => {
        cancelled = true;
        chart?.destroy();
      });
    });
  }
}
