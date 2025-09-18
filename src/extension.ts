import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext)
{
	context.subscriptions.push(
		vscode.commands.registerCommand('vscode-wrap-markdown.wrapSelectedLines', () => {
			const selection = vscode.window.activeTextEditor?.selection;

			if (selection !== undefined)
			{
				wrapSelectedLines(selection.start.line, selection.end.line);
			}
		}),
		vscode.commands.registerCommand('vscode-wrap-markdown.wrapFile', () => {
			const lineCount = vscode.window.activeTextEditor?.document.lineCount;

			if (lineCount !== undefined)
			{
				wrapSelectedLines(0, lineCount - 1);
			}
		}),
	);
}

export function deactivate() {}

/**
 * Various markdown syntax that can prefix a line, that change how we should deal with wrapping that
 * line (particularly indentation.)
 */
const markdownLinePrefixes: { regex: RegExp, appliesToAllLines: boolean }[] = [
	{
		// Block quote.
		regex: /^> /,
		appliesToAllLines: true
	},
	{
		// Numbered list item.
		regex: /^[1-9]+\. /,
		appliesToAllLines: false
	},
	{
		// Unordered list item.
		regex: /^- /,
		appliesToAllLines: false
	}
];

function wrapSelectedLines(firstLine: number, lastLine: number)
{
	const editorConfig = vscode.workspace.getConfiguration('editor');
	const targetWrapColumn = editorConfig.get<number[]>('rulers')?.at(0);

	if (targetWrapColumn === undefined)
	{
		vscode.window.showErrorMessage('Can\'t wrap if you don\'t define a ruler to wrap at!');
		return;
	}

	const editor = vscode.window.activeTextEditor;

	if (editor === undefined)
	{
		return;
	}

	const changedLines: { pos: vscode.Range, newContent: string }[] = [];

	for (let i = firstLine; i <= lastLine; i ++)
	{
		const line = editor.document.lineAt(i);
		const outputLines: string[] = [];
		
		let indentation = line.text.substring(0, line.firstNonWhitespaceCharacterIndex);
		let firstLineSpecialIndent = indentation;
		let text = line.text.substring(indentation.length);

		while (true)
		{
			let foundAnyMatches = false;

			for (const prefix of markdownLinePrefixes)
			{
				const match = text.match(prefix.regex)?.at(0);

				if (match === undefined)
				{
					continue;
				}

				foundAnyMatches = true;
				firstLineSpecialIndent += match;

				if (prefix.appliesToAllLines)
				{
					indentation += match;
				}
				else
				{
					indentation += ' '.repeat(match.length);
				}
				
				text = text.substring(match.length);
			}

			if (!foundAnyMatches)
			{
				break;
			}
		}

		const maxLineWidth = (targetWrapColumn - indentation.length);
		let columnOffset = indentation.length;

		while (line.range.end.character - columnOffset > maxLineWidth)
		{
			const wordOverlapColumn = editor.document
				.getWordRangeAtPosition(line.range.start.translate(0, columnOffset + maxLineWidth + 1), /\S+/)
				?.start
				.translate(0, -columnOffset)
				.character
				?? maxLineWidth;

			if (wordOverlapColumn === 0)
			{
				// This line can't be wrapped, its one massive word!
				break;
			}

			// Cut before the overlapping word.
			outputLines.push(text.substring(0, wordOverlapColumn).trimEnd());
			text = text.substring(wordOverlapColumn);

			columnOffset += wordOverlapColumn;
		}

		if (outputLines.length > 0)
		{
			outputLines[0] = firstLineSpecialIndent + outputLines[0];
			outputLines.push(text);

			changedLines.push({
				pos: line.range,
				newContent: outputLines.join('\n' + indentation)
			});
		}
	}

	editor.edit(edit => {
		changedLines.forEach(({ pos, newContent }) => edit.replace(pos, newContent));
	});
}
