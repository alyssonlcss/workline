export class IncidencePdfFormatter {
  static extractBlueFlags(flags: any[]): any[] {
    if (!flags) return [];
    
    const results: any[] = [];
    flags.filter((f: any) => f.color === 'blue' || f.color === 'red').forEach((flag: any) => {
      const txt = (flag.plainText || flag.html.replace(/<[^>]*>/g, '')).replace(/\n/g, ' ').trim();
      const colonIndex = txt.indexOf(':');
      const linkProps = flag.href ? { link: flag.href, decoration: 'underline' } : {};
      
      const buildTextNodes = (contentStr: string, isValue: boolean) => {
        const themeColor = flag.color === 'red' ? '#dc2626' : '#1d4ed8';
        const baseColor = isValue ? '#334155' : themeColor;
        const baseBold = !isValue;
        const finalLinkProps = isValue ? linkProps : (flag.href ? { link: flag.href, decoration: 'underline' } : {});
        
        if (flag.retornoHref && flag.retornoStr && contentStr.endsWith(flag.retornoStr)) {
          const firstPart = contentStr.substring(0, contentStr.length - flag.retornoStr.length);
          return [
            { text: firstPart, color: baseColor, bold: baseBold, ...finalLinkProps },
            { text: ' | ', color: '#334155', bold: false },
            { text: flag.retornoStr.replace(' | ', ''), color: '#334155', bold: false, link: flag.retornoHref, decoration: 'underline' }
          ];
        }
        return [ { text: contentStr, color: baseColor, bold: baseBold, ...finalLinkProps } ];
      };

      if (colonIndex > -1) {
        const prefix = txt.substring(0, colonIndex + 1);
        const rest = txt.substring(colonIndex + 1);
        const themeColor = flag.color === 'red' ? '#dc2626' : '#1d4ed8';
        results.push({
          text: [
            { text: prefix, color: themeColor, bold: true },
            ...buildTextNodes(rest, true)
          ],
          margin: [8, 1, 0, 1],
          fontSize: 6.5
        });
      } else {
        results.push({
          text: buildTextNodes(txt, false),
          margin: [8, 1, 0, 1],
          fontSize: 6.5
        });
      }
    });
    return results;
  }

  static appendTagsToEventFlags(tags: any[], ev: any): void {
    if (!tags || tags.length === 0) return;
    const extraTags = tags.map((t: any) => t.label);
    ev.flags = [...new Set([...(ev.flags || []), ...extraTags])];
  }
}
