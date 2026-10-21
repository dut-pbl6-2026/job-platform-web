import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import type { AdminStatistics } from "../types/admin";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend);

const GREEN = "#00b14f";
const BLUE = "#2563eb";
const AMBER = "#d97706";
const RED = "#dc2626";

const baseOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: "bottom" as const, labels: { boxWidth: 12, font: { size: 12 } } },
  },
};

export function ActivityLineChart({ stats }: { stats: AdminStatistics }) {
  const labels = stats.series.map((p) => p.label);
  return (
    <div className="admin-chart" role="img" aria-label="Biểu đồ xu hướng người dùng, tin đăng và đơn ứng tuyển">
      <Line
        options={{
          ...baseOptions,
          scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
        }}
        data={{
          labels,
          datasets: [
            { label: "Người dùng mới", data: stats.series.map((p) => p.users), borderColor: BLUE, backgroundColor: BLUE, tension: 0.3 },
            { label: "Tin đăng", data: stats.series.map((p) => p.jobs), borderColor: GREEN, backgroundColor: GREEN, tension: 0.3 },
            { label: "Đơn ứng tuyển", data: stats.series.map((p) => p.applications), borderColor: AMBER, backgroundColor: AMBER, tension: 0.3 },
          ],
        }}
      />
    </div>
  );
}

export function CategoryBarChart({ stats }: { stats: AdminStatistics }) {
  if (stats.categories.length === 0) return <p className="hint">Không có dữ liệu danh mục.</p>;
  return (
    <div className="admin-chart admin-chart--short" role="img" aria-label="Biểu đồ tin theo danh mục">
      <Bar
        options={{
          ...baseOptions,
          indexAxis: "y" as const,
          plugins: { ...baseOptions.plugins, legend: { display: false } },
          scales: { x: { beginAtZero: true, ticks: { precision: 0 } } },
        }}
        data={{
          labels: stats.categories.map((c) => c.name),
          datasets: [{ label: "Tin", data: stats.categories.map((c) => c.count), backgroundColor: GREEN, borderRadius: 6 }],
        }}
      />
    </div>
  );
}

export function StatusDoughnutChart({ stats }: { stats: AdminStatistics }) {
  const status = stats.applicationStatus;
  const values = [status.pending, status.reviewed, status.accepted, status.rejected];
  if (values.every((n) => n === 0)) return <p className="hint">Chưa có đơn ứng tuyển.</p>;
  return (
    <div className="admin-chart admin-chart--short" role="img" aria-label="Biểu đồ trạng thái đơn ứng tuyển">
      <Doughnut
        options={baseOptions}
        data={{
          labels: ["Chờ", "Đã xem", "Nhận", "Từ chối"],
          datasets: [{ data: values, backgroundColor: [AMBER, BLUE, GREEN, RED], borderWidth: 0 }],
        }}
      />
    </div>
  );
}
