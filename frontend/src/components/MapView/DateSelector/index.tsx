import React, {
  forwardRef,
  Ref,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSelector } from 'react-redux';
import {
  Button,
  createStyles,
  Grid,
  Hidden,
  Theme,
  WithStyles,
  withStyles,
} from '@material-ui/core';
import DatePicker from 'react-datepicker';
import Draggable, { DraggableEvent } from 'react-draggable';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretUp } from '@fortawesome/free-solid-svg-icons';
import { ChevronLeft, ChevronRight } from '@material-ui/icons';
import 'react-datepicker/dist/react-datepicker.css';
import { findIndex, get, isEqual } from 'lodash';
import { useUrlHistory } from '../../../utils/url-utils';
import { DateRangeType } from '../../../config/types';
import { findDateIndex, TIMELINE_ITEM_WIDTH, USER_DATE_OFFSET } from './utils';
import { dateRangeSelector } from '../../../context/mapStateSlice/selectors';
import TimelineItems from './TimelineItems';
import { moment, useSafeTranslation } from '../../../i18n';
import {
  DEFAULT_DATE_FORMAT,
  MONTH_FIRST_DATE_FORMAT,
  MONTH_ONLY_DATE_FORMAT,
} from '../../../utils/name-utils';
import {
  DateCompatibleLayer,
  getPossibleDatesForLayer,
} from '../../../utils/server-utils';
import { availableDatesSelector } from '../../../context/serverStateSlice';

interface InputProps {
  value?: string;
  onClick?: () => void;
}

type Point = {
  x: number;
  y: number;
};

const TIMELINE_ID = 'dateTimelineSelector';
const POINTER_ID = 'datePointerSelector';

const Input = forwardRef(
  ({ value, onClick }: InputProps, ref?: Ref<HTMLButtonElement>) => {
    return (
      <Button variant="outlined" onClick={onClick} ref={ref}>
        {value}
      </Button>
    );
  },
);

function DateSelector({
  availableDates = [],
  selectedLayers = [],
  classes,
}: DateSelectorProps) {
  const { startDate: stateStartDate } = useSelector(dateRangeSelector);
  const serverAvailableDates = useSelector(availableDatesSelector);
  const { t, i18n } = useSafeTranslation();
  const [dateRange, setDateRange] = useState<DateRangeType[]>([
    {
      value: 0,
      label: '',
      month: '',
      isFirstDay: false,
    },
  ]);

  const [timelinePosition, setTimelinePosition] = useState<Point>({
    x: 0,
    y: 0,
  });
  const [pointerPosition, setPointerPosition] = useState<Point>({ x: 0, y: 0 });

  const dateRef = useRef(availableDates);

  const timeLine = useRef(null);
  const timeLineWidth = get(timeLine.current, 'offsetWidth', 0);

  const { updateHistory } = useUrlHistory();

  const selectedLayerDates = useMemo(
    () =>
      selectedLayers.map(layer => {
        return getPossibleDatesForLayer(layer, serverAvailableDates)
          .filter(value => value) // null check
          .flat();
      }),
    [selectedLayers, serverAvailableDates],
  );
  const selectedLayerTitles = useMemo(
    () => selectedLayers.map(layer => layer.title),
    [selectedLayers],
  );

  // Move the slider automatically so that the pointer always visible
  useEffect(() => {
    let x = 0;
    if (
      pointerPosition.x >=
      dateRange.length * TIMELINE_ITEM_WIDTH - timeLineWidth
    ) {
      // eslint-disable-next-line fp/no-mutation
      x = timeLineWidth - dateRange.length * TIMELINE_ITEM_WIDTH;
    } else if (pointerPosition.x > timeLineWidth) {
      // eslint-disable-next-line fp/no-mutation
      x = -pointerPosition.x + timeLineWidth / 2;
    }
    if (
      -timelinePosition.x > pointerPosition.x ||
      -timelinePosition.x + timeLineWidth < pointerPosition.x
    ) {
      setTimelinePosition({ x, y: 0 });
    }
  }, [dateRange.length, pointerPosition, timeLineWidth, timelinePosition.x]);

  const dateStrToUpperCase = (dateStr: string): string =>
    `${dateStr.slice(0, 1).toUpperCase()}${dateStr.slice(1)}`;

  // Create timeline range and set pointer position
  useEffect(() => {
    const locale = t('date_locale') ? t('date_locale') : 'en';
    const range = Array.from(
      moment()
        .range(
          moment(stateStartDate).startOf('year'),
          moment(stateStartDate).endOf('year'),
        )
        .by('days'),
    ).map(date => {
      date.locale(locale);
      return {
        value: date.valueOf(),
        label: dateStrToUpperCase(date.format(MONTH_FIRST_DATE_FORMAT)),
        month: dateStrToUpperCase(date.format(MONTH_ONLY_DATE_FORMAT)),
        isFirstDay: date.date() === date.startOf('month').date(),
      };
    });
    setDateRange(range);
    const dateIndex = findIndex(range, date => {
      return (
        date.label ===
        moment(stateStartDate).locale(locale).format(MONTH_FIRST_DATE_FORMAT)
      );
    });
    setPointerPosition({
      x: dateIndex * TIMELINE_ITEM_WIDTH,
      y: 0,
    });
  }, [stateStartDate, t, i18n]);

  function updateStartDate(date: Date) {
    const time = date.getTime();
    // This updates state because a useEffect in MapView updates the redux state
    // TODO this is convoluted coupling, we should update state here if feasible.
    updateHistory('date', moment(time).format(DEFAULT_DATE_FORMAT));
  }

  function setDatePosition(date: number | undefined, increment: number) {
    const dates = availableDates.map(d => {
      return d + USER_DATE_OFFSET;
    });
    const selectedIndex = findDateIndex(dates, date);
    if (dates[selectedIndex + increment]) {
      updateStartDate(new Date(dates[selectedIndex + increment]));
    }
  }

  // move pointer to closest date when change map layer
  useEffect(() => {
    if (!isEqual(dateRef.current, availableDates)) {
      setDatePosition(stateStartDate, 0);
      dateRef.current = availableDates;
    }
  });

  function incrementDate() {
    setDatePosition(stateStartDate, 1);
  }

  function decrementDate() {
    setDatePosition(stateStartDate, -1);
  }

  // Click on available date to move the pointer
  const clickDate = (index: number) => {
    const dates = availableDates.map(date => {
      return date + USER_DATE_OFFSET;
    });
    const selectedIndex = findDateIndex(dates, dateRange[index].value);
    if (selectedIndex >= 0 && dates[selectedIndex] !== stateStartDate) {
      setPointerPosition({ x: index * TIMELINE_ITEM_WIDTH, y: 0 });
      updateStartDate(new Date(dates[selectedIndex]));
    }
  };

  // Set timeline position after being dragged
  const onTimelineStop = (e: DraggableEvent, position: Point) => {
    setTimelinePosition(position);
  };

  // Set pointer position after being dragged
  const onPointerStop = (e: DraggableEvent, position: Point) => {
    const exactX = Math.round(position.x / TIMELINE_ITEM_WIDTH);
    if (exactX >= dateRange.length) {
      return;
    }
    const dates = availableDates.map(date => {
      return date + USER_DATE_OFFSET;
    });
    const selectedIndex = findDateIndex(dates, dateRange[exactX].value);
    if (selectedIndex >= 0 && dates[selectedIndex] !== stateStartDate) {
      setPointerPosition({ x: exactX * TIMELINE_ITEM_WIDTH, y: position.y });
      updateStartDate(new Date(dates[selectedIndex]));
    }
  };

  return (
    <div className={classes.container}>
      <Grid
        container
        alignItems="center"
        justify="center"
        className={classes.datePickerContainer}
      >
        <Grid item xs={12} sm={1} className={classes.datePickerGrid}>
          <Hidden smUp>
            <Button onClick={decrementDate}>
              <ChevronLeft />
            </Button>
          </Hidden>

          <DatePicker
            locale={t('date_locale')}
            dateFormat="PP"
            className={classes.datePickerInput}
            selected={moment(stateStartDate).toDate()}
            onChange={updateStartDate}
            maxDate={new Date()}
            todayButton={t('Today')}
            peekNextMonth
            showMonthDropdown
            showYearDropdown
            dropdownMode="select"
            customInput={<Input />}
            includeDates={availableDates.map(
              d => new Date(d + USER_DATE_OFFSET),
            )}
          />

          <Hidden smUp>
            <Button onClick={incrementDate}>
              <ChevronRight />
            </Button>
          </Hidden>
        </Grid>

        <Grid item xs={12} sm className={classes.slider}>
          <Hidden xsDown>
            <Button onClick={decrementDate}>
              <ChevronLeft />
            </Button>
          </Hidden>
          <Grid className={classes.dateContainer} ref={timeLine}>
            <Draggable
              axis="x"
              handle={`#${TIMELINE_ID}`}
              bounds={{
                top: 0,
                bottom: 0,
                right: 0,
                left: timeLineWidth - dateRange.length * TIMELINE_ITEM_WIDTH,
              }}
              position={timelinePosition}
              onStop={onTimelineStop}
            >
              <div className={classes.timeline} id={TIMELINE_ID}>
                <Grid
                  container
                  alignItems="stretch"
                  className={classes.dateLabelContainer}
                >
                  <TimelineItems
                    dateRange={dateRange}
                    intersectionDates={availableDates}
                    selectedLayerDates={selectedLayerDates}
                    clickDate={clickDate}
                    selectedLayerTitles={selectedLayerTitles}
                  />
                </Grid>
                <Draggable
                  axis="x"
                  handle={`#${POINTER_ID}`}
                  bounds={{
                    top: 0,
                    bottom: 0,
                    left: 0,
                    right: dateRange.length * TIMELINE_ITEM_WIDTH,
                  }}
                  grid={[TIMELINE_ITEM_WIDTH, 1]}
                  position={pointerPosition}
                  onStart={(e: DraggableEvent) => e.stopPropagation()}
                  onStop={onPointerStop}
                >
                  <div className={classes.pointer} id={POINTER_ID}>
                    <FontAwesomeIcon
                      icon={faCaretUp}
                      style={{ fontSize: 40 }}
                      color="white"
                    />
                  </div>
                </Draggable>
              </div>
            </Draggable>
          </Grid>
          <Hidden xsDown>
            <Button onClick={incrementDate}>
              <ChevronRight />
            </Button>
          </Hidden>
        </Grid>
      </Grid>
    </div>
  );
}

const styles = (theme: Theme) =>
  createStyles({
    container: {
      position: 'absolute',
      bottom: '8%',
      zIndex: theme.zIndex.modal,
      width: '100vw',
    },

    datePickerContainer: {
      backgroundColor: theme.palette.primary.main,
      borderRadius: theme.shape.borderRadius,
      padding: theme.spacing(1),
      width: '90%',
      margin: 'auto',
      textAlign: 'center',
    },

    datePickerInput: {
      backgroundColor: theme.palette.primary.main,
    },

    datePickerGrid: {
      display: 'flex',
      minWidth: 150,
      justifyContent: 'center',
      [theme.breakpoints.down('xs')]: {
        marginBottom: theme.spacing(1),
      },
    },

    slider: {
      display: 'flex',
    },

    dateContainer: {
      position: 'relative',
      height: 36,
      flexGrow: 1,
      cursor: 'e-resize',
      overflow: 'hidden',
    },

    dateLabelContainer: {
      position: 'absolute',
      flexWrap: 'nowrap',
    },

    timeline: {
      position: 'relative',
      top: 5,
    },

    pointer: {
      cursor: 'pointer',
      position: 'absolute',
      left: -12,
      top: -12,
    },
  });

export interface DateSelectorProps extends WithStyles<typeof styles> {
  availableDates?: number[];
  selectedLayers: DateCompatibleLayer[];
}

export default withStyles(styles)(DateSelector);
