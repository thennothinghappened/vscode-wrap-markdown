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

// This method is called when your extension is deactivated
export function deactivate() {}

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
		let columnOffset = 0;

		const outputLines: string[] = [];
		let text = line.text;

		while (line.range.end.character - columnOffset > targetWrapColumn)
		{
			const wordOverlapColumn = editor.document
				.getWordRangeAtPosition(line.range.start.translate(0, columnOffset + targetWrapColumn), /\S+/)
				?.start
				.translate(0, -columnOffset)
				.character
				?? targetWrapColumn;

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
			changedLines.push({
				pos: line.range,
				newContent: outputLines.join('\n') + text
			});
		}
	}

	editor.edit(edit => {
		changedLines.forEach(({ pos, newContent }) => edit.replace(pos, newContent));
	});
}
