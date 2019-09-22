
export function w(s: string, l: number, c: string): string {
    c = c || " ";
    const filling = Array(25).join(c[0]);
    return (s + filling).substr(0, l);
}
