import { useState, useRef, useEffect, memo } from 'react';
import { YooEditor, YooptaBlockData } from '../../editor/types';
import DragIcon from './icons/drag.svg';
import PlusIcon from './icons/plus.svg';
import { generateId } from '../../utils/generateId';
import { findSlateBySelectionPath } from '../../utils/findSlateBySelectionPath';
import { getRootBlockElement } from '../../utils/blockElements';
import { ReactEditor } from 'slate-react';
import { Editor, Transforms } from 'slate';
import { BlockOptions } from '../../UI/BlockOptions/BlockOptions';
import { Blocks } from '../../editor/blocks';
import { Portal } from '../../UI/Portal/Portal';
import { useActionMenuToolRefs, useBlockOptionsRefs } from './hooks';
import { Overlay } from '../../UI/Overlay/Overlay';
import { throttle } from '../../utils/throttle';

type dragHandleProps = {
  attributes: any;
  listeners: any;
  setActivatorNodeRef: any;
};

type FloatingBlockActionsProps = {
  editor: YooEditor;
  dragHandleProps: dragHandleProps | null;
};

type ActionStyles = {
  position: 'fixed';
  top: number;
  left: number;
  opacity: number;
  transform: string;
  transition: string;
};

const INITIAL_STYLES: ActionStyles = {
  position: 'fixed',
  top: 0,
  left: 0,
  opacity: 0,
  transform: 'scale(0.95) translateX(-46px)',
  transition: 'opacity 150ms ease-out',
};

export const FloatingBlockActions = memo(({ editor, dragHandleProps }: FloatingBlockActionsProps) => {
  const [hoveredBlock, setHoveredBlock] = useState<YooptaBlockData | null>(null);
  const blockActionsRef = useRef<HTMLDivElement>(null);
  const [actionStyles, setActionStyles] = useState<ActionStyles>(INITIAL_STYLES);

  const { attributes, listeners, setActivatorNodeRef } = dragHandleProps || {};

  const { isBlockOptionsMounted, setIsBlockOptionsOpen, blockOptionsFloatingStyle, blockOptionsRefs } =
    useBlockOptionsRefs();

  const {
    isActionMenuOpen,
    actionMenuRefs,
    hasActionMenu,
    actionMenuStyles,
    onChangeActionMenuOpen,
    onCloseActionMenu,
    actionMenuRenderProps,
    ActionMenu,
  } = useActionMenuToolRefs({ editor });

  const updateBlockPosition = (blockElement: HTMLElement, blockData: YooptaBlockData) => {
    setHoveredBlock(blockData);

    const blockElementRect = blockElement.getBoundingClientRect();
    const blockActionsWidth = blockActionsRef.current?.offsetWidth || 46;

    setActionStyles((prev) => ({
      ...prev,
      top: blockElementRect.top + 2,
      left: blockElementRect.left,
      opacity: 1,
      transform: `scale(1) translateX(-${blockActionsWidth}px)`,
    }));
  };

  const hideBlockActions = () => {
    setActionStyles((prev) => ({
      ...prev,
      opacity: 0,
      transform: INITIAL_STYLES.transform,
    }));

    setTimeout(() => {
      setHoveredBlock(null);
    }, 150);
  };

  const handleMouseMove = (event: MouseEvent) => {
    const isInsideEditor = editor.refElement?.contains(event.target as Node);
    const isInsideActions = blockActionsRef.current?.contains(event.target as Node);

    if (!isInsideEditor) return hideBlockActions();
    if (editor.readOnly) return;
    if (isInsideActions) return;

    const target = event.target as HTMLElement;
    const blockElement = target.closest('[data-yoopta-block]') as HTMLElement;

    if (blockElement) {
      const blockId = blockElement.getAttribute('data-yoopta-block-id');

      if (blockId === hoveredBlock?.id) return;

      const blockData = editor.children[blockId || ''];
      if (blockData) updateBlockPosition(blockElement, blockData);
    }
  };

  const throttledMouseMove = throttle(handleMouseMove, 100, { leading: true, trailing: true });

  useEffect(() => {
    document.addEventListener('scroll', hideBlockActions);
    document.addEventListener('mousemove', throttledMouseMove);

    return () => {
      document.removeEventListener('scroll', hideBlockActions);
      document.removeEventListener('mousemove', throttledMouseMove);
      throttledMouseMove.cancel();
    };
  }, []);

  const onPlusClick = () => {
    const block = hoveredBlock;
    if (!block) return;

    const slate = Blocks.getBlockSlate(editor, { id: block.id });
    const blockEntity = editor.blocks[block.type];
    if (!slate) return;

    const blockEl = document.querySelector(`[data-yoopta-block-id="${block.id}"]`);
    const rootElement = getRootBlockElement(blockEntity.elements);
    let string: undefined | string;
    if (!blockEntity.hasCustomEditor) {
      string = Editor.string(slate, [0]);
    }

    const isEmptyString = typeof string === 'string' && string.trim().length === 0;
    if (hasActionMenu && isEmptyString && rootElement?.props?.nodeType !== 'void') {
      editor.setPath({ current: block.meta.order });
      editor.focusBlock(block.id);
      actionMenuRefs.setReference(blockEl);
      onChangeActionMenuOpen(true);
    } else {
      const defaultBlock = Blocks.buildBlockData({ id: generateId() });
      const nextPath = block.meta.order + 1;
      editor.setPath({ current: block.meta.order });
      editor.insertBlock(defaultBlock.type, { at: nextPath, focus: true });
      if (hasActionMenu) {
        setTimeout(() => {
          if (blockEl) actionMenuRefs.setReference(blockEl.nextSibling as HTMLElement);
          onChangeActionMenuOpen(true);
        }, 0);
      }
    }
  };

  const onSelectBlock = (event: React.MouseEvent) => {
    event.stopPropagation();
    const block = hoveredBlock;
    if (!block) return;

    const slate = findSlateBySelectionPath(editor, { at: block.meta.order });
    editor.focusBlock(block.id);

    if (!slate) return;

    setTimeout(() => {
      const currentBlock = editor.blocks[block.type];

      if (!currentBlock.hasCustomEditor) {
        ReactEditor.blur(slate);
        ReactEditor.deselect(slate);
        Transforms.deselect(slate);
      }

      editor.setPath({ current: block.meta.order, selected: [block.meta.order] });

      setIsBlockOptionsOpen(true);
    }, 10);
  };

  const onDragButtonRef = (node: HTMLElement | null) => {
    setActivatorNodeRef?.(node);
    blockOptionsRefs.setReference(node);
  };

  return (
    <Portal id="block-actions">
      <div contentEditable={false} style={actionStyles} className="yoopta-block-actions" ref={blockActionsRef}>
        <div className="yoopta-block-action-buttons">
          {isActionMenuOpen && hasActionMenu && (
            <Portal id="yoo-block-options-portal">
              <Overlay lockScroll className="yoo-editor-z-[100]" onClick={onCloseActionMenu}>
                <div style={actionMenuStyles} ref={actionMenuRefs.setFloating}>
                  {/* @ts-ignore - fixme */}
                  <ActionMenu {...actionMenuRenderProps} />
                </div>
              </Overlay>
            </Portal>
          )}
          <button type="button" onClick={onPlusClick} className="yoopta-block-actions-plus">
            <PlusIcon />
          </button>
          <button
            ref={onDragButtonRef}
            type="button"
            className="yoopta-block-actions-drag"
            onClick={onSelectBlock}
            {...attributes}
            {...listeners}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M21.1211 16.547L16.1188 11.8533C15.7473 11.5086 15.3012 11.3343 14.8498 11.3343C14.3869 11.3343 13.9716 11.4932 13.5862 11.8379L9.77238 15.2464L8.21471 13.8408C7.86005 13.5214 7.47009 13.3609 7.07472 13.3609C6.68409 13.3609 6.33465 13.513 5.98691 13.8323L2.80002 16.6885C2.84156 18.2443 3.56523 19.0561 4.96328 19.0561H18.654C20.3481 19.0561 21.1925 18.182 21.1211 16.547ZM4.77008 19.7658H19.2299C21.0594 19.7658 22 18.8322 22 17.0304V6.74629C22 4.94292 21.0594 4.00391 19.2299 4.00391H4.77008C2.94745 4.00391 2 4.94292 2 6.74629V17.0304C2 18.8322 2.94745 19.7658 4.77008 19.7658ZM4.86601 18.1114C4.08085 18.1114 3.65441 17.7049 3.65441 16.8844V6.89069C3.65441 6.07023 4.08085 5.65831 4.86601 5.65831H19.1339C19.9122 5.65831 20.3455 6.07023 20.3455 6.89069V16.8844C20.3455 17.7049 19.9122 18.1114 19.1339 18.1114H4.86601Z"
                fill="#272727"
              />
              <path
                d="M8.54183 12.0382C9.64785 12.0382 10.5597 11.1263 10.5597 10.0103C10.5597 8.90428 9.64785 7.98402 8.54183 7.98402C7.42582 7.98402 6.514 8.90428 6.514 10.0103C6.514 11.1263 7.42582 12.0382 8.54183 12.0382Z"
                fill="#272727"
              />
            </svg>
          </button>
          <BlockOptions
            isOpen={isBlockOptionsMounted}
            refs={blockOptionsRefs}
            style={blockOptionsFloatingStyle}
            onClose={() => setIsBlockOptionsOpen(false)}
          />
        </div>
      </div>
    </Portal>
  );
});

FloatingBlockActions.displayName = 'FloatingBlockActions';
