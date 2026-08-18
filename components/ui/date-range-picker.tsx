"use client"

import * as React from "react"
import { format, subDays, subMonths, subYears, startOfMonth, endOfMonth } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export interface DateRangePickerProps extends React.HTMLAttributes<HTMLDivElement> {
    onUpdate?: (values: { range: DateRange | undefined, label?: string }) => void;
}

export function DateRangePicker({
    className,
    onUpdate,
    ...props
}: DateRangePickerProps) {
    const [date, setDate] = React.useState<DateRange | undefined>({
        from: subDays(new Date(), 7),
        to: new Date(),
    })

    const [tempDate, setTempDate] = React.useState<DateRange | undefined>(date)
    const [tempLabel, setTempLabel] = React.useState<string | undefined>("Last 7 days")
    const [open, setOpen] = React.useState(false)
    const [isMounted, setIsMounted] = React.useState(false)

    React.useEffect(() => {
        setIsMounted(true)
    }, [])

    React.useEffect(() => {
        if (open) {
            setTempDate(date)
        }
    }, [open, date])

    if (!isMounted) {
        return <div className={cn("grid gap-2 h-10 w-full sm:w-[260px] bg-slate-100 rounded-xl animate-pulse", className)}></div>
    }

    const presets = [
        {
            label: "Today",
            getValue: () => {
                const today = new Date();
                return { from: today, to: today };
            }
        },
        {
            label: "Last 7 days",
            getValue: () => {
                const today = new Date();
                return { from: subDays(today, 7), to: today };
            }
        },
        {
            label: "Last 30 days",
            getValue: () => {
                const today = new Date();
                return { from: subDays(today, 30), to: today };
            }
        },
        {
            label: "This Month",
            getValue: () => {
                const today = new Date();
                return { from: startOfMonth(today), to: endOfMonth(today) };
            }
        },
        {
            label: "Last 3 Months",
            getValue: () => {
                const today = new Date();
                return { from: subMonths(today, 3), to: today };
            }
        },
        {
            label: "Last 6 Months",
            getValue: () => {
                const today = new Date();
                return { from: subMonths(today, 6), to: today };
            }
        },
        {
            label: "Last 1 year",
            getValue: () => {
                const today = new Date();
                return { from: subYears(today, 1), to: today };
            }
        },
    ];

    const handlePresetChange = (value: string) => {
        const preset = presets.find(p => p.label === value);
        if (preset) {
            setTempDate(preset.getValue());
            setTempLabel(value);
        }
    };

    const handleApply = () => {
        setDate(tempDate);
        setOpen(false);
        if (onUpdate) {
            onUpdate({ range: tempDate, label: tempLabel });
        }
    };

    const handleCancel = () => {
        setOpen(false);
    };

    const handleClear = () => {
        setDate(undefined);
        setTempDate(undefined);
        setTempLabel(undefined);
        if (onUpdate) {
            onUpdate({ range: undefined, label: undefined });
        }
    };

    return (
        <div className={cn("grid gap-2", className)}>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        id="date"
                        variant={"outline"}
                        className={cn(
                            "w-full sm:w-[260px] justify-start text-left font-normal bg-white border-border text-slate-900 hover:bg-zinc-50 rounded-xl h-10 shadow-sm",
                            !date && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4 text-blue-500" />
                        {date?.from ? (
                            date.to ? (
                                <>
                                    {format(date.from, "LLL dd, y")} -{" "}
                                    {format(date.to, "LLL dd, y")}
                                </>
                            ) : (
                                format(date.from, "LLL dd, y")
                            )
                        ) : (
                            <span>Pick a date</span>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[calc(100vw-2rem)] sm:w-auto p-0 max-h-[80vh] overflow-y-auto" align="end">
                    <div className="flex flex-col sm:flex-row">
                        <div className="p-2 border-b sm:border-b-0 sm:border-r border-border sm:w-[160px]">
                            <div className="flex sm:block gap-1 sm:gap-0 sm:space-y-1 overflow-x-auto sm:overflow-visible">
                                {presets.map((preset) => (
                                    <Button
                                        key={preset.label}
                                        variant="ghost"
                                        className="w-auto sm:w-full justify-start font-normal text-sm h-8 whitespace-nowrap flex-shrink-0"
                                        onClick={() => handlePresetChange(preset.label)}
                                    >
                                        {preset.label}
                                    </Button>
                                ))}
                                <div className="sm:pt-2 sm:mt-2 sm:border-t border-border flex-shrink-0">
                                    <Button
                                        variant="ghost"
                                        className="w-auto sm:w-full justify-start font-normal text-sm h-8 text-slate-500 hover:text-slate-900 whitespace-nowrap"
                                        onClick={() => setTempLabel("Custom Range")}
                                    >
                                        Custom Range
                                    </Button>
                                </div>
                            </div>
                        </div>
                        <div className="p-0 overflow-x-auto">
                            <Calendar
                                initialFocus
                                mode="range"
                                defaultMonth={tempDate?.from}
                                selected={tempDate}
                                onSelect={(val) => {
                                    setTempDate(val);
                                    setTempLabel("Custom Range");
                                }}
                                numberOfMonths={1}
                                className="sm:hidden"
                            />
                            <Calendar
                                initialFocus
                                mode="range"
                                defaultMonth={tempDate?.from}
                                selected={tempDate}
                                onSelect={(val) => {
                                    setTempDate(val);
                                    setTempLabel("Custom Range");
                                }}
                                numberOfMonths={2}
                                className="hidden sm:block"
                            />
                        </div>
                    </div>
                    <div className="p-3 border-t border-border flex items-center justify-end gap-2 bg-slate-50/50">
                        <Button variant="ghost" size="sm" onClick={handleClear} className="h-8 px-4 text-red-500 hover:text-red-600 hover:bg-red-50 mr-auto font-medium">
                            Clear
                        </Button>
                        <Button variant="ghost" size="sm" onClick={handleCancel} className="h-8 px-4 text-slate-500 hover:text-slate-900 font-medium">
                            Cancel
                        </Button>
                        <Button size="sm" onClick={handleApply} className="h-8 px-4 bg-blue-600 hover:bg-blue-700 text-white shadow-sm font-medium">
                            Apply
                        </Button>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    )
}
